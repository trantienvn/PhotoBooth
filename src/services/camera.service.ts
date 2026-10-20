import type { CameraDevice, CameraSettings, CameraCapabilities, Resolution } from '@/types';

const RESOLUTION_CONSTRAINTS: Record<Resolution, MediaTrackConstraints> = {
  '480p': { width: { ideal: 854 }, height: { ideal: 480 } },
  '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
  '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } },
  'best': { width: { ideal: 3840 }, height: { ideal: 2160 } },
};

export class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;

  /** Check if running on a secure context (HTTPS or localhost) */
  static isSecureContext(): boolean {
    return window.isSecureContext;
  }

  /** List all available video input devices */
  static async listCameras(): Promise<CameraDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${d.deviceId.slice(0, 6)}`,
        facing: undefined,
      }));
  }

  /** Start camera stream with given settings */
  async start(settings: CameraSettings): Promise<MediaStream> {
    await this.stop(); // Stop any existing stream first

    const resConstraints = RESOLUTION_CONSTRAINTS[settings.resolution];
    const constraints: MediaStreamConstraints = {
      video: {
        ...resConstraints,
        deviceId: settings.deviceId ? { exact: settings.deviceId } : undefined,
        facingMode: settings.facing ?? (settings.deviceId ? undefined : 'user'),
      },
      audio: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.stream;
    } catch (err) {
      // Fallback: try without exact deviceId if exact fails
      if (settings.deviceId && err instanceof Error && err.name === 'OverconstrainedError') {
        const fallback = { ...constraints, video: { ...resConstraints } };
        this.stream = await navigator.mediaDevices.getUserMedia(fallback);
        return this.stream;
      }
      throw err;
    }
  }

  /** Attach stream to a video element */
  attachToVideo(video: HTMLVideoElement): void {
    this.videoElement = video;
    if (this.stream) {
      video.srcObject = this.stream;
    }
  }

  /** Stop the stream and release all tracks */
  async stop(): Promise<void> {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  /** Get the active stream */
  getStream(): MediaStream | null {
    return this.stream;
  }

  /** Capture a frame from a video element, returns a canvas */
  static captureFrame(
    video: HTMLVideoElement,
    mirror: boolean,
    targetWidth?: number,
    targetHeight?: number,
  ): HTMLCanvasElement {
    const w = targetWidth ?? video.videoWidth;
    const h = targetHeight ?? video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    if (mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    return canvas;
  }

  /** Check camera capabilities */
  static getCapabilities(stream: MediaStream): CameraCapabilities {
    const track = stream.getVideoTracks()[0];
    if (!track) {
      return { zoom: false, brightness: false, contrast: false, torch: false };
    }
    const caps = track.getCapabilities?.() as Record<string, unknown> | undefined;
    if (!caps) {
      return { zoom: false, brightness: false, contrast: false, torch: false };
    }
    const zoomCap = caps['zoom'] as { min?: number; max?: number } | undefined;
    return {
      zoom: 'zoom' in caps,
      brightness: 'brightness' in caps,
      contrast: 'contrast' in caps,
      torch: 'torch' in caps,
      minZoom: zoomCap?.min,
      maxZoom: zoomCap?.max,
    };
  }

  /** Apply constraints to the video track (zoom, brightness, etc.) */
  static async applyTrackConstraints(
    stream: MediaStream,
    constraints: MediaTrackConstraints,
  ): Promise<void> {
    const track = stream.getVideoTracks()[0];
    if (track && track.applyConstraints) {
      await track.applyConstraints(constraints);
    }
  }

  /** Get current video track settings */
  static getTrackSettings(stream: MediaStream): MediaTrackSettings | null {
    const track = stream.getVideoTracks()[0];
    return track ? track.getSettings() : null;
  }
}
