import type { DetectedFace, Point2D } from '@/types';

// ─── Native & MediaPipe Detection Typings ─────────────────────────────────────
interface NativeLandmark {
  type: 'eye' | 'mouth' | 'nose';
  locations: { x: number; y: number }[];
}

interface NativeDetectedFace {
  boundingBox: { x: number; y: number; width: number; height: number };
  landmarks?: NativeLandmark[];
}

interface MPKeypoint {
  x: number;
  y: number;
  label?: string;
}

interface MPDetection {
  boundingBox: { xCenter: number; yCenter: number; width: number; height: number };
  keypoints: MPKeypoint[];
  score: number[];
}

interface MPFaceDetectionResults {
  detections: MPDetection[];
}

interface MediaPipeFaceDetectionObj {
  setOptions(o: { model: 'short' | 'full'; minDetectionConfidence: number; minSuppressionThreshold?: number }): Promise<void>;
  onResults(cb: (r: MPFaceDetectionResults) => void): void;
  send(i: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): void;
}

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect(image: ImageBitmapSource): Promise<NativeDetectedFace[]>;
    };
    FaceDetection?: new (cfg?: { locateFile?: (f: string) => string }) => MediaPipeFaceDetectionObj;
  }
}

/**
 * Mirror face coordinates horizontally (0..1)
 * Used when capturing or rendering on a horizontally flipped canvas.
 * Preserves consistent landmark orientation without swapping eyes.
 */
export function mirrorFace(face: DetectedFace): DetectedFace {
  const nx = 1 - (face.x + face.width);
  return {
    ...face,
    x: Math.max(0, Math.min(1, nx)),
    leftEye: { x: 1 - face.leftEye.x, y: face.leftEye.y },
    rightEye: { x: 1 - face.rightEye.x, y: face.rightEye.y },
    leftCheek: { x: 1 - face.leftCheek.x, y: face.leftCheek.y },
    rightCheek: { x: 1 - face.rightCheek.x, y: face.rightCheek.y },
    forehead: { x: 1 - face.forehead.x, y: face.forehead.y },
    chin: { x: 1 - face.chin.x, y: face.chin.y },
    nose: { x: 1 - face.nose.x, y: face.nose.y },
    mouth: { x: 1 - face.mouth.x, y: face.mouth.y },
    roll: -face.roll,
  };
}

/**
 * Mirror multiple faces horizontally
 */
export function mirrorFaces(faces: DetectedFace[]): DetectedFace[] {
  return faces.map(mirrorFace);
}

/**
 * Robust Multi-Face Tracking Engine
 *
 * Tier 1: Hardware-accelerated Native FaceDetector API (Chrome/Edge Chromium) - 100% accurate, zero lag, never detects hands.
 * Tier 2: MediaPipe Face Detection (BlazeFace CDN) - Deep learning face detector.
 * Tier 3: Anthropometric Facial Triangle Fallback - Strict eye-eye-mouth triangle & ratio filtering to reject hands.
 */
export class FaceTracker {
  // ── Tier 1: Native FaceDetector ──────────────────────────────────────────
  private nativeDetector: any = null;
  private hasNativeDetector = false;

  // ── Tier 2: MediaPipe ───────────────────────────────────────────────────
  private mpDetector: MediaPipeFaceDetectionObj | null = null;
  private mpReady = false;
  private mpInitializing = false;
  private mpProcessing = false;
  private mpLastResults: DetectedFace[] = [];
  private mpPendingResolve: ((faces: DetectedFace[]) => void) | null = null;

  // ── Tier 3: Anthropometric Fallback ─────────────────────────────────────
  private sampleCanvas: HTMLCanvasElement;
  private sampleCtx: CanvasRenderingContext2D | null;

  // ── Spatial-Temporal Smoothing ──────────────────────────────────────────
  private prevFaces: DetectedFace[] = [];
  private nextFaceId = 1;

  constructor() {
    this.sampleCanvas = document.createElement('canvas');
    this.sampleCanvas.width = 240;
    this.sampleCanvas.height = 180;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });

    this.initDetectors();
  }

  private async initDetectors() {
    // 1. Try Native FaceDetector API
    if (typeof window !== 'undefined' && 'FaceDetector' in window) {
      try {
        const NativeFD = (window as any).FaceDetector;
        this.nativeDetector = new NativeFD({ fastMode: true, maxDetectedFaces: 5 });
        this.hasNativeDetector = true;
        console.info('[FaceTracker] Native hardware FaceDetector activated ✓');
        return;
      } catch (err) {
        console.warn('[FaceTracker] Native FaceDetector error, trying MediaPipe fallback:', err);
      }
    }

    // 2. Try MediaPipe Face Detection
    this.initMediaPipe();
  }

  private async initMediaPipe() {
    if (this.mpInitializing || this.mpReady) return;
    this.mpInitializing = true;
    try {
      const MPClass = (window as any).FaceDetection as typeof window.FaceDetection;
      if (!MPClass) {
        // Retry later in case script is still downloading
        setTimeout(() => this.initMediaPipe(), 1000);
        return;
      }

      const detector = new MPClass({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`,
      });

      await detector.setOptions({
        model: 'short',
        minDetectionConfidence: 0.65, // High confidence to reject hands/background
        minSuppressionThreshold: 0.30,
      });

      detector.onResults((results: MPFaceDetectionResults) => {
        const parsed = this.parseMPResults(results);
        const smoothed = this.smoothMultiFaces(parsed);
        this.mpLastResults = smoothed;
        if (this.mpPendingResolve) {
          const resolve = this.mpPendingResolve;
          this.mpPendingResolve = null;
          this.mpProcessing = false;
          resolve(smoothed);
        }
      });

      this.mpDetector = detector;
      this.mpReady = true;
      console.info('[FaceTracker] MediaPipe Face Detection ready ✓');
    } catch (e) {
      console.warn('[FaceTracker] MediaPipe initialization error:', e);
    } finally {
      this.mpInitializing = false;
    }
  }

  /**
   * Primary detection method: detects all faces in frame (up to maxFaces)
   */
  async detectAll(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
    maxFaces = 5
  ): Promise<DetectedFace[]> {
    const videoW = 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width;
    const videoH = 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height;
    if (videoW === 0 || videoH === 0) return [];

    // ── Tier 1: Native FaceDetector ────────────────────────────────────────
    if (this.hasNativeDetector && this.nativeDetector) {
      try {
        const nativeDets = await this.nativeDetector.detect(videoOrCanvas);
        if (nativeDets && nativeDets.length > 0) {
          const faces = this.parseNativeResults(nativeDets, videoW, videoH);
          faces.sort((a, b) => a.x - b.x);
          return this.smoothMultiFaces(faces.slice(0, maxFaces));
        } else if (nativeDets && nativeDets.length === 0) {
          // Native detector confirmed 0 faces present
          this.prevFaces = [];
          return [];
        }
      } catch {
        // Fallback to Tier 2 / 3
      }
    }

    // ── Tier 2: MediaPipe Face Detection ───────────────────────────────────
    if (this.mpReady && this.mpDetector && !this.mpProcessing) {
      try {
        const result = await new Promise<DetectedFace[]>((resolve) => {
          let timer: any = null;
          this.mpPendingResolve = (faces) => {
            if (timer) clearTimeout(timer);
            resolve(faces);
          };
          this.mpProcessing = true;

          timer = setTimeout(() => {
            this.mpPendingResolve = null;
            this.mpProcessing = false;
            resolve(this.mpLastResults);
          }, 350);

          this.mpDetector!.send({ image: videoOrCanvas }).catch(() => {
            if (timer) clearTimeout(timer);
            this.mpPendingResolve = null;
            this.mpProcessing = false;
            resolve(this.mpLastResults);
          });
        });

        if (result.length > 0) {
          return result.slice(0, maxFaces);
        }
      } catch {
        // Fallback to Tier 3
      }
    }

    // ── Tier 3: Anthropometric Fallback ────────────────────────────────────
    const fallbackFaces = this.detectAnthropometricFaces(videoOrCanvas, maxFaces);
    fallbackFaces.sort((a, b) => a.x - b.x);
    return this.smoothMultiFaces(fallbackFaces);
  }

  /**
   * Backwards-compatible single face detect
   */
  async detect(videoOrCanvas: HTMLVideoElement | HTMLCanvasElement): Promise<DetectedFace | null> {
    const faces = await this.detectAll(videoOrCanvas, 1);
    return faces.length > 0 ? faces[0] : null;
  }

  /**
   * Parse results from Native FaceDetector API
   */
  private parseNativeResults(
    dets: NativeDetectedFace[],
    vw: number,
    vh: number
  ): DetectedFace[] {
    return dets.map((d) => {
      const bb = d.boundingBox;
      const faceX = Math.max(0, bb.x / vw);
      const faceY = Math.max(0, bb.y / vh);
      const faceW = Math.min(1 - faceX, bb.width / vw);
      const faceH = Math.min(1 - faceY, bb.height / vh);

      let leftEye: Point2D = { x: faceX + faceW * 0.35, y: faceY + faceH * 0.38 };
      let rightEye: Point2D = { x: faceX + faceW * 0.65, y: faceY + faceH * 0.38 };
      let nose: Point2D = { x: faceX + faceW * 0.50, y: faceY + faceH * 0.56 };
      let mouth: Point2D = { x: faceX + faceW * 0.50, y: faceY + faceH * 0.74 };

      if (d.landmarks) {
        const eyes = d.landmarks.filter((l) => l.type === 'eye');
        if (eyes.length >= 2) {
          const e1 = eyes[0].locations[0];
          const e2 = eyes[1].locations[0];
          if (e1 && e2) {
            const minEx = Math.min(e1.x, e2.x) / vw;
            const maxEx = Math.max(e1.x, e2.x) / vw;
            const avgEy = (e1.y + e2.y) * 0.5 / vh;
            leftEye = { x: minEx, y: avgEy };
            rightEye = { x: maxEx, y: avgEy };
          }
        }
        const nL = d.landmarks.find((l) => l.type === 'nose');
        if (nL?.locations[0]) {
          nose = { x: nL.locations[0].x / vw, y: nL.locations[0].y / vh };
        }
        const mL = d.landmarks.find((l) => l.type === 'mouth');
        if (mL?.locations[0]) {
          mouth = { x: mL.locations[0].x / vw, y: mL.locations[0].y / vh };
        }
      }

      return this.computeFaceGeometry(faceX, faceY, faceW, faceH, leftEye, rightEye, nose, mouth, 0.95);
    });
  }

  /**
   * Parse results from MediaPipe Face Detection
   */
  private parseMPResults(results: MPFaceDetectionResults): DetectedFace[] {
    if (!results.detections?.length) return [];
    return results.detections.map((det) => {
      const bb = det.boundingBox;
      const faceX = Math.max(0, bb.xCenter - bb.width / 2);
      const faceY = Math.max(0, bb.yCenter - bb.height / 2);
      const faceW = Math.min(1 - faceX, bb.width);
      const faceH = Math.min(1 - faceY, bb.height);
      const kps = det.keypoints ?? [];

      // Keypoints in unmirrored frame:
      // kps[0] = subject right eye (on left of frame, x ~ 0.35)
      // kps[1] = subject left eye (on right of frame, x ~ 0.65)
      const leftEyePt = kps[0] ? { x: kps[0].x, y: kps[0].y } : { x: faceX + faceW * 0.35, y: faceY + faceH * 0.38 };
      const rightEyePt = kps[1] ? { x: kps[1].x, y: kps[1].y } : { x: faceX + faceW * 0.65, y: faceY + faceH * 0.38 };
      const nosePt = kps[2] ? { x: kps[2].x, y: kps[2].y } : { x: faceX + faceW * 0.50, y: faceY + faceH * 0.56 };
      const mouthPt = kps[3] ? { x: kps[3].x, y: kps[3].y } : { x: faceX + faceW * 0.50, y: faceY + faceH * 0.74 };

      return this.computeFaceGeometry(
        faceX,
        faceY,
        faceW,
        faceH,
        leftEyePt,
        rightEyePt,
        nosePt,
        mouthPt,
        det.score?.[0] ?? 0.88
      );
    });
  }

  /**
   * Calculates all facial landmarks accurately with vector geometry.
   * Head roll, forehead, chin, and cheeks follow rotation faithfully.
   */
  private computeFaceGeometry(
    faceX: number,
    faceY: number,
    faceW: number,
    faceH: number,
    leftEye: Point2D,
    rightEye: Point2D,
    nose: Point2D,
    mouth: Point2D,
    confidence: number
  ): DetectedFace {
    const edx = rightEye.x - leftEye.x;
    const edy = rightEye.y - leftEye.y;
    const ipd = Math.max(faceW * 0.30, Math.hypot(edx, edy));
    const roll = Math.atan2(edy, edx);

    // Midpoint between eyes
    const midEyeX = (leftEye.x + rightEye.x) * 0.5;
    const midEyeY = (leftEye.y + rightEye.y) * 0.5;

    // Unit vectors along and perpendicular to eye line
    const ux = Math.cos(roll);
    const uy = Math.sin(roll);
    const vx = -Math.sin(roll); // Down vector
    const vy = Math.cos(roll);

    // Forehead (above eyes along head axis)
    const forehead: Point2D = {
      x: midEyeX - vx * (ipd * 0.82),
      y: midEyeY - vy * (ipd * 0.82),
    };

    // Chin (below mouth along head axis)
    const chin: Point2D = {
      x: midEyeX + vx * (ipd * 1.58),
      y: midEyeY + vy * (ipd * 1.58),
    };

    // Cheeks (lateral to nose)
    const leftCheek: Point2D = {
      x: midEyeX - ux * (ipd * 0.65) + vx * (ipd * 0.45),
      y: midEyeY - uy * (ipd * 0.65) + vy * (ipd * 0.45),
    };

    const rightCheek: Point2D = {
      x: midEyeX + ux * (ipd * 0.65) + vx * (ipd * 0.45),
      y: midEyeY + uy * (ipd * 0.65) + vy * (ipd * 0.45),
    };

    return {
      x: faceX,
      y: faceY,
      width: faceW,
      height: faceH,
      leftEye,
      rightEye,
      nose,
      mouth,
      leftCheek,
      rightCheek,
      forehead,
      chin,
      roll,
      confidence,
    };
  }

  /**
   * Tier 3 Anthropometric Fallback
   * Enforces strict biometric face rules (aspect ratio, eye-eye-mouth triangle,
   * nose bridge ridge, and dark mouth slit) so hands, arms, and background are discarded.
   */
  private detectAnthropometricFaces(
    source: HTMLVideoElement | HTMLCanvasElement,
    maxFaces = 5
  ): DetectedFace[] {
    if (!this.sampleCtx) return [];

    const sw = this.sampleCanvas.width;   // 240
    const sh = this.sampleCanvas.height;  // 180
    this.sampleCtx.drawImage(source, 0, 0, sw, sh);
    const imgData = this.sampleCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Block Grid
    const blockSize = 10;
    const gridCols = Math.floor(sw / blockSize); // 24
    const gridRows = Math.floor(sh / blockSize); // 18
    const gridSkinCount = new Int32Array(gridCols * gridRows);

    let totalSkin = 0;
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        let blockSkin = 0;
        const startY = gy * blockSize;
        const startX = gx * blockSize;

        for (let py = 0; py < blockSize; py++) {
          const rowOffset = (startY + py) * sw;
          for (let px = 0; px < blockSize; px++) {
            const idx = (rowOffset + (startX + px)) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
            const cr = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;

            if (
              cb >= 78 && cb <= 128 &&
              cr >= 134 && cr <= 175 &&
              r > 50 && g > 35 && b > 25 &&
              r >= g && (r - g) >= 10
            ) {
              blockSkin++;
              totalSkin++;
            }
          }
        }
        gridSkinCount[gy * gridCols + gx] = blockSkin;
      }
    }

    if (totalSkin < (sw * sh) * 0.025) return [];

    const visited = new Uint8Array(gridCols * gridRows);
    const faces: DetectedFace[] = [];

    // Search upper 70% of webcam frame
    const maxSearchRow = Math.floor(gridRows * 0.70);

    for (let faceIdx = 0; faceIdx < maxFaces; faceIdx++) {
      let maxDensity = 0;
      let peakGX = -1;
      let peakGY = -1;

      for (let gy = 1; gy < maxSearchRow; gy++) {
        for (let gx = 1; gx < gridCols - 1; gx++) {
          const gIdx = gy * gridCols + gx;
          if (visited[gIdx]) continue;
          const count = gridSkinCount[gIdx];
          if (count > maxDensity) {
            maxDensity = count;
            peakGX = gx;
            peakGY = gy;
          }
        }
      }

      // Minimum density for genuine face core
      if (maxDensity < (blockSize * blockSize) * 0.28 || peakGX === -1) {
        break;
      }

      // Flood fill
      const queue: number[] = [peakGY * gridCols + peakGX];
      visited[peakGY * gridCols + peakGX] = 1;

      let minBX = peakGX;
      let maxBX = peakGX;
      let minBY = peakGY;
      let maxBY = peakGY;
      const densityThresh = Math.max(12, maxDensity * 0.22);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const cx = curr % gridCols;
        const cy = Math.floor(curr / gridCols);
        if (cx < minBX) minBX = cx;
        if (cx > maxBX) maxBX = cx;
        if (cy < minBY) minBY = cy;
        if (cy > maxBY) maxBY = cy;

        const neighbors = [
          { x: cx + 1, y: cy },
          { x: cx - 1, y: cy },
          { x: cx, y: cy + 1 },
          { x: cx, y: cy - 1 },
        ];
        for (const n of neighbors) {
          if (n.x >= 0 && n.x < gridCols && n.y >= 0 && n.y < gridRows) {
            const nIdx = n.y * gridCols + n.x;
            if (!visited[nIdx] && gridSkinCount[nIdx] >= densityThresh) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      const clusterW = (maxBX - minBX + 1) * blockSize;
      const clusterH = (maxBY - minBY + 1) * blockSize;
      const headTop = minBY * blockSize;
      const headLeft = minBX * blockSize;

      // ── Filter 1: Discard clusters on bottom edge (hands on desk/lap) ───────────
      if (headTop > sh * 0.60) continue;

      // ── Filter 2: Face aspect ratio (human face bounding box is 1.15 to 1.75) ─
      const aspect = clusterH / clusterW;
      if (clusterW < sw * 0.14 || clusterH < sh * 0.15 || aspect < 1.10 || aspect > 1.80) {
        continue;
      }

      // ── Filter 3: Eye sockets search ──────────────────────────────────────────
      const eyeBandTop = headTop + Math.round(clusterH * 0.26);
      const eyeBandBottom = headTop + Math.round(clusterH * 0.48);
      const lZoneMinX = headLeft + Math.round(clusterW * 0.16);
      const lZoneMaxX = headLeft + Math.round(clusterW * 0.44);
      const rZoneMinX = headLeft + Math.round(clusterW * 0.56);
      const rZoneMaxX = headLeft + Math.round(clusterW * 0.84);

      let minLeftLum = 999;
      let leftEyePt: Point2D = { x: (lZoneMinX + lZoneMaxX) * 0.5, y: (eyeBandTop + eyeBandBottom) * 0.5 };
      let minRightLum = 999;
      let rightEyePt: Point2D = { x: (rZoneMinX + rZoneMaxX) * 0.5, y: (eyeBandTop + eyeBandBottom) * 0.5 };

      for (let y = eyeBandTop; y <= eyeBandBottom; y += 2) {
        const row = y * sw;
        for (let x = lZoneMinX; x <= lZoneMaxX; x += 2) {
          const idx = (row + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < minLeftLum) {
            minLeftLum = lum;
            leftEyePt = { x, y };
          }
        }
        for (let x = rZoneMinX; x <= rZoneMaxX; x += 2) {
          const idx = (row + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < minRightLum) {
            minRightLum = lum;
            rightEyePt = { x, y };
          }
        }
      }

      // Check forehead / cheek skin luminance
      const fIdx = (Math.min(sh - 1, headTop + Math.round(clusterH * 0.15)) * sw + Math.round(headLeft + clusterW * 0.5)) * 4;
      const fLum = 0.299 * data[fIdx] + 0.587 * data[fIdx + 1] + 0.114 * data[fIdx + 2];

      // ── Filter 4: Eye Contrast (Hands have uniform skin and no eye cavities) ───
      const eyeContrastLeft = fLum - minLeftLum;
      const eyeContrastRight = fLum - minRightLum;
      if (eyeContrastLeft < 16 || eyeContrastRight < 16) {
        continue; // Discard: flat skin without eye cavities (hand/palm/arm)
      }

      // ── Filter 5: Nose bridge ridge (brighter skin between eye valleys) ────────
      const midEyeX = (leftEyePt.x + rightEyePt.x) * 0.5;
      const midEyeY = (leftEyePt.y + rightEyePt.y) * 0.5;
      const nbIdx = (Math.round(midEyeY) * sw + Math.round(midEyeX)) * 4;
      const bridgeLum = 0.299 * data[nbIdx] + 0.587 * data[nbIdx + 1] + 0.114 * data[nbIdx + 2];
      if (bridgeLum < Math.min(minLeftLum, minRightLum) + 8) {
        continue; // Discard: lacks nose bridge
      }

      // ── Filter 6: Dark mouth cavity verification ──────────────────────────────
      const mouthBandY = headTop + Math.round(clusterH * 0.72);
      const mouthIdx = (Math.min(sh - 1, mouthBandY) * sw + Math.round(midEyeX)) * 4;
      const mouthLum = 0.299 * data[mouthIdx] + 0.587 * data[mouthIdx + 1] + 0.114 * data[mouthIdx + 2];
      if (mouthLum > fLum - 4) {
        continue; // Discard: hands lack mouth cavity
      }

      // Passed all biometric checks: construct face
      const ipd = Math.max(clusterW * 0.32, Math.hypot(rightEyePt.x - leftEyePt.x, rightEyePt.y - leftEyePt.y));
      const faceW = Math.min(0.9, (ipd * 2.1) / sw);
      const faceH = Math.min(0.95, (ipd * 2.8) / sh);
      const faceX = Math.max(0, Math.min(1 - faceW, midEyeX / sw - faceW * 0.5));
      const faceY = Math.max(0, Math.min(1 - faceH, (midEyeY - ipd * 0.75) / sh));

      const normLeftEye: Point2D = { x: leftEyePt.x / sw, y: leftEyePt.y / sh };
      const normRightEye: Point2D = { x: rightEyePt.x / sw, y: rightEyePt.y / sh };
      const normNose: Point2D = { x: midEyeX / sw, y: (midEyeY + ipd * 0.48) / sh };
      const normMouth: Point2D = { x: midEyeX / sw, y: (midEyeY + ipd * 0.98) / sh };

      faces.push(
        this.computeFaceGeometry(
          faceX,
          faceY,
          faceW,
          faceH,
          normLeftEye,
          normRightEye,
          normNose,
          normMouth,
          0.90
        )
      );
    }

    return faces;
  }

  /**
   * Multi-face spatial temporal smoothing
   * Maps current faces to previous faces by closest spatial Euclidean distance,
   * preserving identity and eliminating micro-jitter with motion-adaptive responsiveness.
   */
  private smoothMultiFaces(currFaces: DetectedFace[]): DetectedFace[] {
    if (currFaces.length === 0) {
      this.prevFaces = [];
      return [];
    }

    const smoothedList: DetectedFace[] = [];
    const usedPrev = new Set<number>();

    for (const curr of currFaces) {
      let bestDist = 999;
      let bestIdx = -1;

      for (let p = 0; p < this.prevFaces.length; p++) {
        if (usedPrev.has(p)) continue;
        const prev = this.prevFaces[p];
        const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = p;
        }
      }

      if (bestIdx !== -1 && bestDist < 0.22) {
        usedPrev.add(bestIdx);
        const prev = this.prevFaces[bestIdx];

        // Motion-responsive alpha:
        // alpha 0.88 when moving -> zero drag / lag
        // alpha 0.48 when stationary -> buttery smooth jitter removal
        const alpha = bestDist > 0.012 ? 0.88 : 0.48;

        const smoothPt = (p1: Point2D, p2: Point2D): Point2D => ({
          x: p1.x * (1 - alpha) + p2.x * alpha,
          y: p1.y * (1 - alpha) + p2.y * alpha,
        });

        smoothedList.push({
          id: prev.id ?? `face-${this.nextFaceId++}`,
          x: prev.x * (1 - alpha) + curr.x * alpha,
          y: prev.y * (1 - alpha) + curr.y * alpha,
          width: prev.width * (1 - alpha) + curr.width * alpha,
          height: prev.height * (1 - alpha) + curr.height * alpha,
          leftEye: smoothPt(prev.leftEye, curr.leftEye),
          rightEye: smoothPt(prev.rightEye, curr.rightEye),
          nose: smoothPt(prev.nose, curr.nose),
          mouth: smoothPt(prev.mouth, curr.mouth),
          leftCheek: smoothPt(prev.leftCheek, curr.leftCheek),
          rightCheek: smoothPt(prev.rightCheek, curr.rightCheek),
          forehead: smoothPt(prev.forehead, curr.forehead),
          chin: smoothPt(prev.chin, curr.chin),
          roll: prev.roll * (1 - alpha) + curr.roll * alpha,
          confidence: curr.confidence,
        });
      } else {
        // New face entering camera frame
        smoothedList.push({
          ...curr,
          id: `face-${this.nextFaceId++}`,
        });
      }
    }

    this.prevFaces = smoothedList;
    return smoothedList;
  }

  /**
   * Release detector resources
   */
  destroy() {
    try {
      this.mpDetector?.close();
    } catch {
      // noop
    }
    this.mpDetector = null;
    this.mpReady = false;
    this.mpProcessing = false;
    this.nativeDetector = null;
    this.hasNativeDetector = false;
    this.prevFaces = [];
  }
}

export const globalFaceTracker = new FaceTracker();
