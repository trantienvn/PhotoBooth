import type { TimelapseState, TimelapseStatus } from '@/types';

const PREFERRED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

export function getSupportedMimeType(): string {
  for (const type of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return ''; // Let browser choose
}

export function getFileExtension(mimeType: string): string {
  if (mimeType.startsWith('video/mp4')) return 'mp4';
  return 'webm';
}

export class TimelapseService {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType: string = '';
  private startTime: number = 0;
  private durationInterval: ReturnType<typeof setInterval> | null = null;
  private onStateChange: (state: Partial<TimelapseState>) => void;

  constructor(onStateChange: (state: Partial<TimelapseState>) => void) {
    this.onStateChange = onStateChange;
  }

  /** Start recording from a MediaStream */
  start(stream: MediaStream): boolean {
    if (this.recorder && this.recorder.state !== 'inactive') return false;

    this.mimeType = getSupportedMimeType();
    this.chunks = [];

    try {
      const options: MediaRecorderOptions = this.mimeType
        ? { mimeType: this.mimeType, videoBitsPerSecond: 2_500_000 }
        : { videoBitsPerSecond: 2_500_000 };

      this.recorder = new MediaRecorder(stream, options);
      this.mimeType = this.recorder.mimeType;

      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
          // Estimate size
          const total = this.chunks.reduce((acc, c) => acc + c.size, 0);
          this.onStateChange({ estimatedSize: total });
        }
      };

      this.recorder.onerror = () => {
        this.onStateChange({ status: 'idle' });
      };

      this.recorder.start(1000); // collect data every second
      this.startTime = Date.now();

      this.durationInterval = setInterval(() => {
        this.onStateChange({ duration: Date.now() - this.startTime });
      }, 500);

      this.onStateChange({ status: 'recording', startedAt: this.startTime, duration: 0, estimatedSize: 0 });
      return true;
    } catch {
      return false;
    }
  }

  /** Pause recording if supported */
  pause(): void {
    if (this.recorder?.state === 'recording') {
      try {
        this.recorder.pause();
        this.onStateChange({ status: 'paused' });
      } catch {
        // pause not supported in some browsers
      }
    }
  }

  /** Resume recording */
  resume(): void {
    if (this.recorder?.state === 'paused') {
      try {
        this.recorder.resume();
        this.onStateChange({ status: 'recording' });
      } catch {
        // ignore
      }
    }
  }

  /** Stop recording and return the blob */
  stop(): Promise<{ blob: Blob; url: string; mimeType: string } | null> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.clearInterval();

      this.recorder.onstop = () => {
        if (this.chunks.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(this.chunks, { type: this.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        this.onStateChange({ status: 'stopped', blobUrl: url, mimeType: this.mimeType });
        resolve({ blob, url, mimeType: this.mimeType });
      };

      this.recorder.stop();
    });
  }

  /** Cleanup: revoke blob URLs, stop recorder */
  destroy(): void {
    this.clearInterval();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.recorder = null;
    this.chunks = [];
  }

  getStatus(): TimelapseStatus {
    if (!this.recorder) return 'idle';
    switch (this.recorder.state) {
      case 'recording': return 'recording';
      case 'paused': return 'paused';
      default: return 'stopped';
    }
  }

  private clearInterval(): void {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }
}
