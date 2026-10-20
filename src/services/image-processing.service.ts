import type { FilterPreset, FilterSettings, FilterPresetName } from '@/types';

export const filterPresets: FilterPreset[] = [
  {
    id: 'original',
    name: 'Original',
    settings: {
      brightness: 0, contrast: 0, saturation: 0, exposure: 0,
      warmth: 0, tint: 0, highlights: 0, shadows: 0,
      fade: 0, vignette: 0, grain: 0, sharpness: 0,
    },
  },
  {
    id: 'natural',
    name: 'Natural',
    settings: {
      brightness: 5, contrast: 5, saturation: 10, exposure: 5,
      warmth: 10, tint: 0, highlights: -10, shadows: 10,
      fade: 0, vignette: 5, grain: 0, sharpness: 10,
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    settings: {
      brightness: 10, contrast: 5, saturation: 15, exposure: 5,
      warmth: 35, tint: 5, highlights: -5, shadows: 15,
      fade: 5, vignette: 10, grain: 0, sharpness: 0,
    },
  },
  {
    id: 'cool',
    name: 'Cool',
    settings: {
      brightness: 5, contrast: 10, saturation: -5, exposure: 0,
      warmth: -30, tint: -10, highlights: 5, shadows: -5,
      fade: 5, vignette: 5, grain: 5, sharpness: 10,
    },
  },
  {
    id: 'vintage',
    name: 'Vintage',
    settings: {
      brightness: -5, contrast: -10, saturation: -20, exposure: -5,
      warmth: 20, tint: 10, highlights: -20, shadows: 20,
      fade: 25, vignette: 30, grain: 30, sharpness: -10,
    },
  },
  {
    id: 'retro',
    name: 'Retro Film',
    settings: {
      brightness: 0, contrast: -5, saturation: -15, exposure: 5,
      warmth: 15, tint: 15, highlights: -15, shadows: 10,
      fade: 20, vignette: 20, grain: 40, sharpness: 0,
    },
  },
  {
    id: 'bw',
    name: 'Black & White',
    settings: {
      brightness: 5, contrast: 20, saturation: -100, exposure: 0,
      warmth: 0, tint: 0, highlights: -10, shadows: 10,
      fade: 0, vignette: 20, grain: 10, sharpness: 20,
    },
  },
  {
    id: 'soft',
    name: 'Soft',
    settings: {
      brightness: 15, contrast: -15, saturation: -5, exposure: 10,
      warmth: 10, tint: 0, highlights: 20, shadows: 20,
      fade: 15, vignette: 0, grain: 0, sharpness: -20,
    },
  },
  {
    id: 'pastel',
    name: 'Pastel',
    settings: {
      brightness: 20, contrast: -20, saturation: -30, exposure: 15,
      warmth: 5, tint: 5, highlights: 30, shadows: 30,
      fade: 30, vignette: 0, grain: 0, sharpness: -10,
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    settings: {
      brightness: -5, contrast: 25, saturation: -10, exposure: -5,
      warmth: -5, tint: -5, highlights: -25, shadows: 25,
      fade: 10, vignette: 35, grain: 15, sharpness: 15,
    },
  },
  {
    id: 'korean',
    name: 'Korean Style',
    settings: {
      brightness: 20, contrast: -10, saturation: -25, exposure: 15,
      warmth: 5, tint: -5, highlights: 25, shadows: 25,
      fade: 20, vignette: 0, grain: 5, sharpness: 0,
    },
  },
  {
    id: 'highcontrast',
    name: 'High Contrast',
    settings: {
      brightness: 0, contrast: 50, saturation: 20, exposure: 0,
      warmth: 0, tint: 0, highlights: -30, shadows: -20,
      fade: 0, vignette: 25, grain: 10, sharpness: 30,
    },
  },
];

export const filterPresetMap = Object.fromEntries(
  filterPresets.map((p) => [p.id, p])
) as Record<FilterPresetName, FilterPreset>;

/**
 * Applies FilterSettings to an HTMLCanvasElement using 2D context CSS filters and manual pixel ops.
 * Returns a new canvas with the filter applied.
 */
export function applyFiltersToCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  settings: FilterSettings,
  targetWidth?: number,
  targetHeight?: number,
): HTMLCanvasElement {
  const srcWidth = source instanceof HTMLCanvasElement ? source.width : (source as HTMLImageElement).naturalWidth;
  const srcHeight = source instanceof HTMLCanvasElement ? source.height : (source as HTMLImageElement).naturalHeight;
  const width = targetWidth ?? srcWidth;
  const height = targetHeight ?? srcHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Build CSS filter string for native filter support
  const { brightness, contrast, saturation, exposure } = settings;
  const brightnessVal = 1 + (brightness + exposure) / 100;
  const contrastVal = 1 + contrast / 100;
  const saturateVal = 1 + saturation / 100;

  ctx.filter = [
    `brightness(${brightnessVal})`,
    `contrast(${contrastVal})`,
    `saturate(${Math.max(0, saturateVal)})`,
  ].join(' ');

  ctx.drawImage(source, 0, 0, width, height);
  ctx.filter = 'none';

  // Warmth - manual pixel manipulation (shift red/blue channels)
  if (settings.warmth !== 0) {
    applyWarmth(ctx, width, height, settings.warmth);
  }

  // Fade overlay
  if (settings.fade > 0) {
    ctx.fillStyle = `rgba(255,255,255,${settings.fade / 100 * 0.5})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Vignette
  if (settings.vignette > 0) {
    applyVignette(ctx, width, height, settings.vignette);
  }

  // Grain
  if (settings.grain > 0) {
    applyGrain(ctx, width, height, settings.grain);
  }

  return canvas;
}

function applyWarmth(ctx: CanvasRenderingContext2D, width: number, height: number, warmth: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const shift = (warmth / 100) * 30;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + shift);         // R
    data[i + 2] = clamp(data[i + 2] - shift); // B
  }
  ctx.putImageData(imageData, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number): void {
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.min(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7,
  );
  const alpha = strength / 100 * 0.8;
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function applyGrain(ctx: CanvasRenderingContext2D, width: number, height: number, strength: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const amount = (strength / 100) * 40;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount;
    data[i] = clamp(data[i] + noise);
    data[i + 1] = clamp(data[i + 1] + noise);
    data[i + 2] = clamp(data[i + 2] + noise);
  }
  ctx.putImageData(imageData, 0, 0);
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}
