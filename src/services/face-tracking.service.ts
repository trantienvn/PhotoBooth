import type { DetectedFace, Point2D } from '@/types';

// Declare Shape Detection API if present in Chrome/Edge
declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect(image: ImageBitmapSource): Promise<Array<{
        boundingBox: DOMRectReadOnly;
        landmarks?: Array<{
          type: 'eye' | 'mouth' | 'nose';
          locations: Array<{ x: number; y: number }>;
        }>;
      }>>;
    };
  }
}

/**
 * Mirror face coordinates horizontally (0..1)
 * Used when capturing or rendering on a horizontally flipped canvas.
 */
export function mirrorFace(face: DetectedFace): DetectedFace {
  const nx = 1 - (face.x + face.width);
  return {
    ...face,
    x: Math.max(0, Math.min(1, nx)),
    // Left eye in original camera frame becomes right eye in mirrored frame
    leftEye: { x: 1 - face.rightEye.x, y: face.rightEye.y },
    rightEye: { x: 1 - face.leftEye.x, y: face.leftEye.y },
    leftCheek: { x: 1 - face.rightCheek.x, y: face.rightCheek.y },
    rightCheek: { x: 1 - face.leftCheek.x, y: face.leftCheek.y },
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

export class FaceTracker {
  private nativeDetector: any = null;
  private prevFaces: DetectedFace[] = [];
  private sampleCanvas: HTMLCanvasElement;
  private sampleCtx: CanvasRenderingContext2D | null;
  private isNativeChecked = false;
  private nextFaceId = 1;

  constructor() {
    this.sampleCanvas = document.createElement('canvas');
    // 240x180 resolution: sub-millisecond execution for multiple faces
    this.sampleCanvas.width = 240;
    this.sampleCanvas.height = 180;
    this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
  }

  private initNativeDetector() {
    if (this.isNativeChecked) return;
    this.isNativeChecked = true;
    if (typeof window !== 'undefined' && window.FaceDetector) {
      try {
        this.nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
      } catch {
        this.nativeDetector = null;
      }
    }
  }

  /**
   * Detect primary single face (backwards-compatible)
   */
  async detect(videoOrCanvas: HTMLVideoElement | HTMLCanvasElement): Promise<DetectedFace | null> {
    const faces = await this.detectAll(videoOrCanvas, 1);
    return faces.length > 0 ? faces[0] : null;
  }

  /**
   * Detect ALL faces present in video or canvas (up to maxFaces)
   */
  async detectAll(
    videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
    maxFaces = 5
  ): Promise<DetectedFace[]> {
    this.initNativeDetector();

    const videoW = 'videoWidth' in videoOrCanvas ? videoOrCanvas.videoWidth : videoOrCanvas.width;
    const videoH = 'videoHeight' in videoOrCanvas ? videoOrCanvas.videoHeight : videoOrCanvas.height;
    if (videoW === 0 || videoH === 0) return [];

    // 1. Try Native Shape Detection API if present
    if (this.nativeDetector) {
      try {
        const detected = await this.nativeDetector.detect(videoOrCanvas);
        if (detected && detected.length > 0) {
          const rawFaces: DetectedFace[] = [];

          for (let i = 0; i < Math.min(maxFaces, detected.length); i++) {
            const raw = detected[i];
            const bb = raw.boundingBox;

            const nx = bb.x / videoW;
            const ny = bb.y / videoH;
            const nw = bb.width / videoW;
            const nh = bb.height / videoH;

            let leftEye: Point2D = { x: nx + nw * 0.32, y: ny + nh * 0.38 };
            let rightEye: Point2D = { x: nx + nw * 0.68, y: ny + nh * 0.38 };
            let nose: Point2D = { x: nx + nw * 0.50, y: ny + nh * 0.55 };
            let mouth: Point2D = { x: nx + nw * 0.50, y: ny + nh * 0.75 };

            if (raw.landmarks) {
              for (const lm of raw.landmarks) {
                if (lm.locations && lm.locations.length > 0) {
                  const loc = lm.locations[0];
                  const p = { x: loc.x / videoW, y: loc.y / videoH };
                  if (lm.type === 'eye') {
                    if (p.x < nx + nw * 0.5) leftEye = p;
                    else rightEye = p;
                  } else if (lm.type === 'nose') {
                    nose = p;
                  } else if (lm.type === 'mouth') {
                    mouth = p;
                  }
                }
              }
            }

            const dx = rightEye.x - leftEye.x;
            const dy = rightEye.y - leftEye.y;
            const roll = Math.atan2(dy, dx);
            const ipd = Math.hypot(dx, dy);

            const midEyeX = (leftEye.x + rightEye.x) / 2;
            const midEyeY = (leftEye.y + rightEye.y) / 2;

            const downX = -Math.sin(roll);
            const downY = Math.cos(roll);
            const rightX = Math.cos(roll);
            const rightY = Math.sin(roll);

            const forehead: Point2D = {
              x: midEyeX - downX * (ipd * 0.72),
              y: midEyeY - downY * (ipd * 0.72),
            };
            const leftCheek: Point2D = {
              x: leftEye.x - rightX * (ipd * 0.16) + downX * (ipd * 0.50),
              y: leftEye.y - rightY * (ipd * 0.16) + downY * (ipd * 0.50),
            };
            const rightCheek: Point2D = {
              x: rightEye.x + rightX * (ipd * 0.16) + downX * (ipd * 0.50),
              y: rightEye.y + rightY * (ipd * 0.16) + downY * (ipd * 0.50),
            };
            const chin: Point2D = {
              x: mouth.x + downX * (ipd * 0.50),
              y: mouth.y + downY * (ipd * 0.50),
            };

            rawFaces.push({
              x: nx,
              y: ny,
              width: nw,
              height: nh,
              leftEye,
              rightEye,
              nose,
              mouth,
              leftCheek,
              rightCheek,
              forehead,
              chin,
              roll,
              confidence: 0.95,
            });
          }

          // Sort faces left-to-right
          rawFaces.sort((a, b) => a.x - b.x);
          return this.smoothMultiFaces(rawFaces);
        }
      } catch {
        // Fallback to high-speed multi-cluster algorithm
      }
    }

    // 2. High-speed Multi-Face 2D Spatial Connected Component Clusters
    const detectedFaces = this.detectMultipleClusters(videoOrCanvas, maxFaces);

    // Sort left to right
    detectedFaces.sort((a, b) => a.x - b.x);
    return this.smoothMultiFaces(detectedFaces);
  }

  /**
   * Multi-cluster face segmenter:
   * Finds multiple distinct people in the webcam frame simultaneously
   */
  private detectMultipleClusters(
    source: HTMLVideoElement | HTMLCanvasElement,
    maxFaces = 5
  ): DetectedFace[] {
    if (!this.sampleCtx) return [];

    const sw = this.sampleCanvas.width;   // 240
    const sh = this.sampleCanvas.height;  // 180

    this.sampleCtx.drawImage(source, 0, 0, sw, sh);
    const imgData = this.sampleCtx.getImageData(0, 0, sw, sh);
    const data = imgData.data;

    // Block Grid: 24 columns x 18 rows (10x10 pixel blocks)
    const blockSize = 10;
    const gridCols = Math.floor(sw / blockSize); // 24
    const gridRows = Math.floor(sh / blockSize); // 18
    const gridSkinCount = new Int32Array(gridCols * gridRows);

    let totalSkinPixels = 0;

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
              cb >= 75 && cb <= 130 &&
              cr >= 132 && cr <= 178 &&
              r > 45 && g > 30 && b > 20 &&
              r >= g && (r - g) >= 8
            ) {
              blockSkin++;
              totalSkinPixels++;
            }
          }
        }

        gridSkinCount[gy * gridCols + gx] = blockSkin;
      }
    }

    if (totalSkinPixels < (sw * sh) * 0.02) {
      return [];
    }

    const visited = new Uint8Array(gridCols * gridRows);
    const faces: DetectedFace[] = [];
    const maxSearchRow = Math.floor(gridRows * 0.75);

    // Iteratively extract up to maxFaces distinct clusters
    for (let faceIdx = 0; faceIdx < maxFaces; faceIdx++) {
      let maxDensity = 0;
      let peakGX = -1;
      let peakGY = -1;

      // Find highest unvisited skin peak
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

      // Threshold: minimum block skin density to qualify as a face center
      if (maxDensity < (blockSize * blockSize) * 0.22 || peakGX === -1) {
        break;
      }

      // 2D Flood fill to isolate this face cluster
      const queue: number[] = [peakGY * gridCols + peakGX];
      visited[peakGY * gridCols + peakGX] = 1;

      let minBlockX = peakGX;
      let maxBlockX = peakGX;
      let minBlockY = peakGY;
      let maxBlockY = peakGY;

      const densityThreshold = Math.max(8, maxDensity * 0.18);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const cx = curr % gridCols;
        const cy = Math.floor(curr / gridCols);

        if (cx < minBlockX) minBlockX = cx;
        if (cx > maxBlockX) maxBlockX = cx;
        if (cy < minBlockY) minBlockY = cy;
        if (cy > maxBlockY) maxBlockY = cy;

        const neighbors = [
          { x: cx + 1, y: cy },
          { x: cx - 1, y: cy },
          { x: cx, y: cy + 1 },
          { x: cx, y: cy - 1 },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < gridCols && n.y >= 0 && n.y < gridRows) {
            const nIdx = n.y * gridCols + n.x;
            if (!visited[nIdx] && gridSkinCount[nIdx] >= densityThreshold) {
              visited[nIdx] = 1;
              queue.push(nIdx);
            }
          }
        }
      }

      // Convert block bounds to pixel bounds
      const headPixelMinX = minBlockX * blockSize;
      const headPixelMaxX = (maxBlockX + 1) * blockSize;
      const headPixelMinY = minBlockY * blockSize;
      const rawHeadPixelMaxY = (maxBlockY + 1) * blockSize;

      const clusterW = headPixelMaxX - headPixelMinX;
      const rawClusterH = rawHeadPixelMaxY - headPixelMinY;

      // 1. Vertical position filter: faces in webcams are in the upper 60% of the frame
      if (headPixelMinY > sh * 0.58) {
        continue; // Discard: hand on table, keyboard, or lap
      }

      // 2. Discard clusters with non-face size or extreme aspect ratio (hands, arms, fingers)
      const aspect = rawClusterH / clusterW;
      if (clusterW < sw * 0.13 || rawClusterH < sh * 0.13 || aspect < 0.82 || aspect > 2.1) {
        continue;
      }

      // Constrain head height by natural human face ratio
      const headPixelMaxY = Math.min(rawHeadPixelMaxY, headPixelMinY + Math.round(clusterW * 1.40));
      const clusterH = headPixelMaxY - headPixelMinY;

      // Eyes search band
      const eyeBandTop = headPixelMinY + Math.round(clusterH * 0.28);
      const eyeBandBottom = headPixelMinY + Math.round(clusterH * 0.50);

      const lZoneMinX = headPixelMinX + Math.round(clusterW * 0.15);
      const lZoneMaxX = headPixelMinX + Math.round(clusterW * 0.46);
      const rZoneMinX = headPixelMinX + Math.round(clusterW * 0.54);
      const rZoneMaxX = headPixelMinX + Math.round(clusterW * 0.85);

      let minLeftLum = 999;
      let leftEyePt: Point2D = {
        x: (lZoneMinX + lZoneMaxX) * 0.5,
        y: (eyeBandTop + eyeBandBottom) * 0.5,
      };

      let minRightLum = 999;
      let rightEyePt: Point2D = {
        x: (rZoneMinX + rZoneMaxX) * 0.5,
        y: (eyeBandTop + eyeBandBottom) * 0.5,
      };

      for (let y = eyeBandTop; y <= eyeBandBottom; y += 2) {
        const rowOffset = y * sw;
        for (let x = lZoneMinX; x <= lZoneMaxX; x += 2) {
          const idx = (rowOffset + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < minLeftLum) {
            minLeftLum = lum;
            leftEyePt = { x, y };
          }
        }
        for (let x = rZoneMinX; x <= rZoneMaxX; x += 2) {
          const idx = (rowOffset + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          if (lum < minRightLum) {
            minRightLum = lum;
            rightEyePt = { x, y };
          }
        }
      }

      // 3. Facial Feature Verification: Real faces have dark eye sockets / pupils / eyebrows
      // Hands, palms, and arms have uniform skin luminance without dark eye valleys
      const foreheadSampleY = Math.min(sh - 1, headPixelMinY + Math.round(clusterH * 0.16));
      const cheekSampleY = Math.min(sh - 1, headPixelMinY + Math.round(clusterH * 0.62));
      const midHeadX = Math.round((headPixelMinX + headPixelMaxX) * 0.5);

      const fIdx = (foreheadSampleY * sw + midHeadX) * 4;
      const fLum = 0.299 * data[fIdx] + 0.587 * data[fIdx + 1] + 0.114 * data[fIdx + 2];

      const lcX = Math.round(headPixelMinX + clusterW * 0.28);
      const lcIdx = (cheekSampleY * sw + lcX) * 4;
      const lcLum = 0.299 * data[lcIdx] + 0.587 * data[lcIdx + 1] + 0.114 * data[lcIdx + 2];

      const rcX = Math.round(headPixelMinX + clusterW * 0.72);
      const rcIdx = (cheekSampleY * sw + rcX) * 4;
      const rcLum = 0.299 * data[rcIdx] + 0.587 * data[rcIdx + 1] + 0.114 * data[rcIdx + 2];

      const avgSkinLum = (fLum + lcLum + rcLum) / 3;

      // Reject if eye regions don't have enough contrast vs forehead/cheeks (hand/palm/arm signature)
      const leftEyeContrast = avgSkinLum - minLeftLum;
      const rightEyeContrast = avgSkinLum - minRightLum;
      if (leftEyeContrast < 13 || rightEyeContrast < 13) {
        continue; // Discard: flat skin tone without eyes (hand, palm, arm)
      }

      // 4. Nose bridge verification (center between eyes is brighter skin than eye valleys)
      const bridgeY = Math.round((leftEyePt.y + rightEyePt.y) * 0.5);
      const bridgeX = Math.round((leftEyePt.x + rightEyePt.x) * 0.5);
      const bIdx = (bridgeY * sw + bridgeX) * 4;
      const bridgeLum = 0.299 * data[bIdx] + 0.587 * data[bIdx + 1] + 0.114 * data[bIdx + 2];

      if (bridgeLum < minLeftLum + 5 || bridgeLum < minRightLum + 5) {
        continue; // Discard: lacks nose bridge ridge between two eye valleys
      }

      // 5. Size dominance: secondary face must be at least 25% of primary face area
      if (faces.length > 0) {
        const primaryArea = faces[0].width * faces[0].height;
        const currentArea = (clusterW / sw) * (clusterH / sh);
        if (currentArea < primaryArea * 0.25) {
          continue; // Discard: tiny hand or peripheral skin spot
        }
      }

      const edx = rightEyePt.x - leftEyePt.x;
      const edy = rightEyePt.y - leftEyePt.y;
      let roll = Math.atan2(edy, edx);

      if (Math.abs(roll) > Math.PI * 0.28) {
        roll = 0;
        rightEyePt.y = leftEyePt.y;
      }

      const ipd = Math.max(clusterW * 0.30, Math.min(clusterW * 0.58, Math.hypot(edx, edy)));
      const midEyeX = (leftEyePt.x + rightEyePt.x) * 0.5;
      const midEyeY = (leftEyePt.y + rightEyePt.y) * 0.5;

      const downX = -Math.sin(roll);
      const downY = Math.cos(roll);
      const rightX = Math.cos(roll);
      const rightY = Math.sin(roll);

      const normLeftEye: Point2D = { x: leftEyePt.x / sw, y: leftEyePt.y / sh };
      const normRightEye: Point2D = { x: rightEyePt.x / sw, y: rightEyePt.y / sh };

      const normForehead: Point2D = {
        x: (midEyeX - downX * (ipd * 0.72)) / sw,
        y: (midEyeY - downY * (ipd * 0.72)) / sh,
      };
      const normNose: Point2D = {
        x: (midEyeX + downX * (ipd * 0.48)) / sw,
        y: (midEyeY + downY * (ipd * 0.48)) / sh,
      };
      const normMouth: Point2D = {
        x: (midEyeX + downX * (ipd * 0.98)) / sw,
        y: (midEyeY + downY * (ipd * 0.98)) / sh,
      };
      const normChin: Point2D = {
        x: (midEyeX + downX * (ipd * 1.50)) / sw,
        y: (midEyeY + downY * (ipd * 1.50)) / sh,
      };
      const normLeftCheek: Point2D = {
        x: (leftEyePt.x - rightX * (ipd * 0.15) + downX * (ipd * 0.48)) / sw,
        y: (leftEyePt.y - rightY * (ipd * 0.15) + downY * (ipd * 0.48)) / sh,
      };
      const normRightCheek: Point2D = {
        x: (rightEyePt.x + rightX * (ipd * 0.15) + downX * (ipd * 0.48)) / sw,
        y: (rightEyePt.y + rightY * (ipd * 0.15) + downY * (ipd * 0.48)) / sh,
      };

      const faceW = Math.min(0.9, (ipd * 2.2) / sw);
      const faceH = Math.min(0.95, (ipd * 2.9) / sh);
      const faceX = Math.max(0, Math.min(1 - faceW, midEyeX / sw - faceW * 0.5));
      const faceY = Math.max(0, Math.min(1 - faceH, (midEyeY - downY * (ipd * 0.78)) / sh));

      faces.push({
        x: faceX,
        y: faceY,
        width: faceW,
        height: faceH,
        leftEye: normLeftEye,
        rightEye: normRightEye,
        nose: normNose,
        mouth: normMouth,
        leftCheek: normLeftCheek,
        rightCheek: normRightCheek,
        forehead: normForehead,
        chin: normChin,
        roll,
        confidence: 0.92,
      });
    }

    return faces;
  }

  /**
   * Multi-face spatial temporal smoothing:
   * Maps current faces to previous faces by closest spatial Euclidean distance,
   * preserving identity and eliminating micro-jitter without motion drag.
   */
  private smoothMultiFaces(currFaces: DetectedFace[]): DetectedFace[] {
    if (currFaces.length === 0) {
      this.prevFaces = [];
      return [];
    }

    const smoothedList: DetectedFace[] = [];
    const usedPrev = new Set<number>();

    for (const curr of currFaces) {
      // Find closest face in previous frame
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

      // If matched with an existing face within 25% screen distance
      if (bestIdx !== -1 && bestDist < 0.25) {
        usedPrev.add(bestIdx);
        const prev = this.prevFaces[bestIdx];

        // Motion responsive alpha:
        // alpha 0.85 when moving -> zero lag
        // alpha 0.50 when resting -> smooth jitter
        const alpha = bestDist > 0.015 ? 0.85 : 0.50;

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
        // New face entering frame
        smoothedList.push({
          ...curr,
          id: `face-${this.nextFaceId++}`,
        });
      }
    }

    this.prevFaces = smoothedList;
    return smoothedList;
  }
}

export const globalFaceTracker = new FaceTracker();
