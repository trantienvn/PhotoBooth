import '@testing-library/jest-dom';

// Mock canvas API for jsdom (not available in test env)
HTMLCanvasElement.prototype.getContext = function(type: string) {
  if (type === '2d') {
    return {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      filter: '',
      globalAlpha: 1,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      font: '',
      fillRect: () => {},
      clearRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      fill: () => {},
      clip: () => {},
      drawImage: () => {},
      fillText: () => {},
      measureText: () => ({ width: 0 }),
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      save: () => {},
      restore: () => {},
      createRadialGradient: () => ({
        addColorStop: () => {},
      }),
      createLinearGradient: () => ({
        addColorStop: () => {},
      }),
      getImageData: () => ({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1,
      }),
      putImageData: () => {},
      quadraticCurveTo: () => {},
    } as unknown as CanvasRenderingContext2D;
  }
  return null;
} as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = function() {
  return 'data:image/png;base64,mockdata';
};

// Mock MediaRecorder
global.MediaRecorder = class MockMediaRecorder {
  static isTypeSupported(type: string) {
    return type === 'video/webm';
  }
  state = 'inactive';
  mimeType = 'video/webm';
  ondataavailable: ((e: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; this.onstop?.(); }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
} as unknown as typeof MediaRecorder;
