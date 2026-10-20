import type { FilterPreset, FilterSettings, FilterPresetName, BeautySettings, DetectedFace } from '@/types';
import { renderFaceBeauty, renderArFilter } from '@/services/ar-filters.service';

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

// ── Live Beauty & Retouch Definitions ──────────────────────────────────

export interface BeautyPresetInfo {
  id: 'off' | 'natural' | 'rosy' | 'porcelain' | 'korean';
  name: string;
  icon: string;
  description: string;
  settings: BeautySettings;
}

export const beautyPresets: BeautyPresetInfo[] = [
  {
    id: 'off',
    name: 'Tắt / Off',
    icon: '🚫',
    description: 'Không làm đẹp',
    settings: {
      enabled: false,
      smooth: 0,
      rosyGlow: 0,
      brighten: 0,
      contrast: 0,
      warmth: 0,
      presetId: 'off',
    },
  },
  {
    id: 'natural',
    name: 'Tự nhiên',
    icon: '🌿',
    description: 'Mịn nhẹ, sáng trong',
    settings: {
      enabled: true,
      smooth: 35,
      rosyGlow: 15,
      brighten: 12,
      contrast: 4,
      warmth: 4,
      presetId: 'natural',
    },
  },
  {
    id: 'rosy',
    name: 'Hồng hào',
    icon: '🌸',
    description: 'Má hồng đào, tươi trẻ',
    settings: {
      enabled: true,
      smooth: 45,
      rosyGlow: 40,
      brighten: 16,
      contrast: 6,
      warmth: 8,
      presetId: 'rosy',
    },
  },
  {
    id: 'porcelain',
    name: 'Trắng sáng',
    icon: '🤍',
    description: 'Da sứ mịn màng',
    settings: {
      enabled: true,
      smooth: 55,
      rosyGlow: 15,
      brighten: 24,
      contrast: -4,
      warmth: -4,
      presetId: 'porcelain',
    },
  },
  {
    id: 'korean',
    name: 'Hàn Quốc',
    icon: '✨',
    description: 'Căng bóng mướt mịn (Glass Skin)',
    settings: {
      enabled: true,
      smooth: 65,
      rosyGlow: 25,
      brighten: 18,
      contrast: -8,
      warmth: 6,
      presetId: 'korean',
    },
  },
];

export const autoEnhanceSettings: BeautySettings = {
  enabled: true,
  smooth: 40,
  rosyGlow: 25,
  brighten: 15,
  contrast: 6,
  warmth: 6,
  presetId: 'natural',
};

/**
 * Returns CSS filter string for live video element
 */
export function getCameraLiveCssFilter(
  filterSettings?: FilterSettings,
  beauty?: BeautySettings
): string {
  const parts: string[] = [];

  const bOffset =
    (filterSettings?.brightness ?? 0) +
    (filterSettings?.exposure ?? 0) +
    (beauty?.enabled ? beauty.brighten * 0.35 : 0);
  const brightnessVal = Math.max(0.2, 1 + bOffset / 100);
  parts.push(`brightness(${brightnessVal.toFixed(2)})`);

  const cOffset =
    (filterSettings?.contrast ?? 0) +
    (beauty?.enabled ? beauty.contrast * 0.8 : 0);
  const contrastVal = Math.max(0.2, 1 + cOffset / 100);
  parts.push(`contrast(${contrastVal.toFixed(2)})`);

  const sOffset =
    (filterSettings?.saturation ?? 0) +
    (beauty?.enabled ? beauty.rosyGlow * 0.2 : 0);
  const saturateVal = Math.max(0, 1 + sOffset / 100);
  parts.push(`saturate(${saturateVal.toFixed(2)})`);

  if (filterSettings?.saturation === -100) {
    parts.push('grayscale(1)');
  }

  const warmth =
    (filterSettings?.warmth ?? 0) +
    (beauty?.enabled ? beauty.warmth * 0.8 : 0);
  if (warmth > 5) {
    parts.push(`sepia(${(Math.min(50, warmth) * 0.35).toFixed(0)}%)`);
  } else if (warmth < -5) {
    parts.push(`hue-rotate(${Math.max(-20, warmth * 0.4).toFixed(0)}deg)`);
  }

  return parts.join(' ');
}

/**
 * Bakes Beauty & Filter settings into a captured frame canvas, including Face Tracking & AR filters
 */
export function applyBeautyAndFilterToCanvas(
  canvas: HTMLCanvasElement,
  beauty?: BeautySettings,
  filterSettings?: FilterSettings,
  faces?: DetectedFace | DetectedFace[]
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const w = canvas.width;
  const h = canvas.height;
  const faceList = faces ? (Array.isArray(faces) ? faces : [faces]) : [];

  // 1. Skin smoothing layer & targeted blush
  if (beauty?.enabled && (beauty.smooth > 0 || beauty.rosyGlow > 0)) {
    if (faceList.length > 0) {
      renderFaceBeauty(ctx, faceList, w, h, beauty);
    } else if (beauty.smooth > 0) {
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const blurCtx = blurCanvas.getContext('2d');
      if (blurCtx) {
        const radius = Math.max(1, Math.round((beauty.smooth / 100) * (w / 320)));
        blurCtx.filter = `blur(${radius}px)`;
        blurCtx.drawImage(canvas, 0, 0);

        ctx.save();
        ctx.globalAlpha = Math.min(0.5, (beauty.smooth / 100) * 0.5);
        ctx.drawImage(blurCanvas, 0, 0);
        ctx.restore();
      }
    }
  }

  // 2. Rosy skin glow (if no face was used for targeted blush)
  if (faceList.length === 0 && beauty?.enabled && beauty.rosyGlow > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const rosyAlpha = Math.min(0.35, (beauty.rosyGlow / 100) * 0.35);
    ctx.fillStyle = `rgba(255, 145, 165, ${rosyAlpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 3. Brightness, Contrast, Saturation
  const bOffset =
    (filterSettings?.brightness ?? 0) +
    (filterSettings?.exposure ?? 0) +
    (beauty?.enabled ? beauty.brighten * 0.35 : 0);
  const cOffset =
    (filterSettings?.contrast ?? 0) +
    (beauty?.enabled ? beauty.contrast * 0.8 : 0);
  const sOffset =
    (filterSettings?.saturation ?? 0) +
    (beauty?.enabled ? beauty.rosyGlow * 0.2 : 0);

  if (bOffset !== 0 || cOffset !== 0 || sOffset !== 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      const bVal = 1 + bOffset / 100;
      const cVal = 1 + cOffset / 100;
      const sVal = Math.max(0, 1 + sOffset / 100);
      tempCtx.filter = `brightness(${bVal}) contrast(${cVal}) saturate(${sVal})`;
      tempCtx.drawImage(canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  // 4. Warmth
  const totalWarmth =
    (filterSettings?.warmth ?? 0) +
    (beauty?.enabled ? beauty.warmth : 0);
  if (totalWarmth !== 0) {
    applyWarmth(ctx, w, h, totalWarmth);
  }

  // 5. Fade, Vignette, Grain from filter
  if (filterSettings?.fade && filterSettings.fade > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(filterSettings.fade / 100) * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (filterSettings?.vignette && filterSettings.vignette > 0) {
    applyVignette(ctx, w, h, filterSettings.vignette);
  }

  if (filterSettings?.grain && filterSettings.grain > 0) {
    applyGrain(ctx, w, h, filterSettings.grain);
  }

  // 6. Render AR filter on top of the captured photo
  if (faceList.length > 0 && beauty?.arFilter && beauty.arFilter !== 'none') {
    renderArFilter(ctx, faceList, w, h, beauty.arFilter);
  }

  return canvas;
}
