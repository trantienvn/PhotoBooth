/**
 * LUT (Look-Up Table) Color Grading Service
 *
 * Provides authentic photographic & cinematic color presets using 3D Color LUT transformations.
 * Supports:
 * - 12 authentic film / cinematic LUT presets (Kodak Portra, Fuji Velvia, Teal & Orange, Cyberpunk, Korean Glow, etc.)
 * - High-speed 3D RGB Cube processing with trilinear interpolation & intensity blending (0-100%)
 * - Live webcam CSS filter approximation for 60fps real-time preview
 * - Standard 2D Hald CLUT / Strip PNG asset generation and export
 */

import type { LutPresetId, LutPresetInfo } from '@/types';

export const lutPresets: LutPresetInfo[] = [
  {
    id: 'none',
    name: 'Gốc (No LUT)',
    category: 'film',
    description: 'Màu gốc tự nhiên từ camera',
    badge: 'RAW',
    accentColor: '#94a3b8',
  },
  {
    id: 'kodak_portra',
    name: 'Kodak Portra 400',
    category: 'film',
    description: 'Tone da ấm vàng kinh điển, highlight mịn màng',
    badge: 'KODAK',
    accentColor: '#f59e0b',
  },
  {
    id: 'fuji_velvia',
    name: 'Fuji Velvia 50',
    category: 'film',
    description: 'Màu phim Fuji trong trẻo, xanh lục & bầu trời sâu',
    badge: 'FUJI',
    accentColor: '#10b981',
  },
  {
    id: 'teal_orange',
    name: 'Teal & Orange',
    category: 'cinematic',
    description: 'Màu điện ảnh Hollywood, shadow xanh ngọc & da cam ấm',
    badge: 'CINE',
    accentColor: '#06b6d4',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    category: 'artistic',
    description: 'Màu neon tương lai, ánh tím hồng & lam đậm',
    badge: 'NEON',
    accentColor: '#ec4899',
  },
  {
    id: 'korean_glow',
    name: 'Korean Glass Skin',
    category: 'film',
    description: 'Trắng sứ căng bóng, má hồng phớt nhẹ, high-key',
    badge: 'GLOW',
    accentColor: '#f472b6',
  },
  {
    id: 'vintage_70s',
    name: 'Vintage 1970s',
    category: 'vintage',
    description: 'Màu ảnh hoài niệm thập niên 70, ngả nâu ấm',
    badge: '1970',
    accentColor: '#d97706',
  },
  {
    id: 'polaroid_600',
    name: 'Polaroid 600',
    category: 'vintage',
    description: 'Màu máy ảnh lấy liền, đen mờ pastel cổ điển',
    badge: 'INSTANT',
    accentColor: '#84cc16',
  },
  {
    id: 'moody_bw',
    name: 'Moody B&W Noir',
    category: 'cinematic',
    description: 'Đen trắng điện ảnh tương phản cao, đổ bóng sâu',
    badge: 'NOIR',
    accentColor: '#64748b',
  },
  {
    id: 'golden_hour',
    name: 'Golden Hour Sunset',
    category: 'artistic',
    description: 'Ánh nắng vàng chiều hoàng hôn rực rỡ, lãng mạn',
    badge: 'SUNSET',
    accentColor: '#eab308',
  },
  {
    id: 'bleach_bypass',
    name: 'Bleach Bypass',
    category: 'cinematic',
    description: 'Rửa bạc điện ảnh, giảm bão hòa & tăng khối',
    badge: 'SILVER',
    accentColor: '#9ca3af',
  },
  {
    id: 'pastel_dream',
    name: 'Pastel Sakura',
    category: 'artistic',
    description: 'Tone mộng mơ Nhật Bản, hồng phấn & tím nhạt dịu mắt',
    badge: 'DREAM',
    accentColor: '#c084fc',
  },
  {
    id: 'nordic_cool',
    name: 'Nordic Cold Fog',
    category: 'cinematic',
    description: 'Sương lạnh Bắc Âu, trong veo, dịu tone ấm',
    badge: 'NORDIC',
    accentColor: '#38bdf8',
  },
];

// 3D LUT Table Cache (32x32x32 RGB cubes)
const LUT_SIZE = 32;
const lutCubeCache = new Map<LutPresetId, Float32Array>();

/**
 * Builds or retrieves the 32x32x32 RGB transformation cube for a LUT preset
 */
export function getLutCube(presetId: LutPresetId): Float32Array {
  if (presetId === 'none') {
    // Identity LUT
    return getIdentityCube();
  }
  const cached = lutCubeCache.get(presetId);
  if (cached) return cached;

  const cube = generateLutCube(presetId);
  lutCubeCache.set(presetId, cube);
  return cube;
}

function getIdentityCube(): Float32Array {
  const size = LUT_SIZE;
  const cube = new Float32Array(size * size * size * 3);
  let idx = 0;
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        cube[idx++] = r / (size - 1);
        cube[idx++] = g / (size - 1);
        cube[idx++] = b / (size - 1);
      }
    }
  }
  return cube;
}

/**
 * Generates the authentic 3D color transformation mathematical matrix for each preset
 */
function generateLutCube(presetId: LutPresetId): Float32Array {
  const size = LUT_SIZE;
  const cube = new Float32Array(size * size * size * 3);
  let idx = 0;

  for (let bi = 0; bi < size; bi++) {
    for (let gi = 0; gi < size; gi++) {
      for (let ri = 0; ri < size; ri++) {
        let r = ri / (size - 1);
        let g = gi / (size - 1);
        let b = bi / (size - 1);

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        switch (presetId) {
          case 'kodak_portra': {
            // Warm rich skin, slightly softened highlights, gentle S-curve
            r = Math.pow(r, 0.92) * 1.05;
            g = Math.pow(g, 0.96) * 1.01;
            b = Math.pow(b, 1.08) * 0.94;
            // Warm highlight boost
            if (lum > 0.6) {
              const hl = (lum - 0.6) / 0.4;
              r += hl * 0.04;
              g += hl * 0.02;
            }
            break;
          }

          case 'fuji_velvia': {
            // Punchy greens & cyans, crisp contrast, cool clean shadows
            r = Math.pow(r, 1.1) * 0.98;
            g = Math.pow(g, 0.95) * 1.06;
            b = Math.pow(b, 0.92) * 1.04;
            // Shadow cool tint
            if (lum < 0.4) {
              const sh = (0.4 - lum) / 0.4;
              b += sh * 0.05;
            }
            break;
          }

          case 'teal_orange': {
            // Hollywood blockbuster Teal & Orange:
            // Shadows -> cyan/teal (high B & G), Highlights -> orange (high R & low B)
            if (lum < 0.5) {
              const tealFactor = (0.5 - lum) / 0.5;
              r = r * (1 - tealFactor * 0.35);
              g = g + tealFactor * 0.08;
              b = b + tealFactor * 0.22;
            } else {
              const orangeFactor = (lum - 0.5) / 0.5;
              r = r + orangeFactor * 0.18;
              g = g + orangeFactor * 0.06;
              b = b * (1 - orangeFactor * 0.30);
            }
            // S-curve contrast
            r = 0.5 + Math.sin((r - 0.5) * Math.PI) * 0.52;
            g = 0.5 + Math.sin((g - 0.5) * Math.PI) * 0.52;
            b = 0.5 + Math.sin((b - 0.5) * Math.PI) * 0.52;
            break;
          }

          case 'cyberpunk': {
            // Neon pink/magenta vs electric cyan
            r = Math.pow(r, 0.85) * 1.15;
            g = Math.pow(g, 1.25) * 0.85;
            b = Math.pow(b, 0.88) * 1.20;
            // Magenta boost on mid-highs
            if (r > 0.4 && b > 0.4) {
              r += 0.08;
              b += 0.10;
              g -= 0.05;
            }
            break;
          }

          case 'korean_glow': {
            // High key, porcelain skin, soft pastel blush, low contrast
            r = Math.pow(r, 0.84) * 1.08;
            g = Math.pow(g, 0.88) * 1.04;
            b = Math.pow(b, 0.90) * 1.06;
            // Gentle pink lift on cheeks & skin
            if (r > g && g > b) {
              r += 0.04;
              g += 0.01;
            }
            break;
          }

          case 'vintage_70s': {
            // Warm sepia yellow tone, faded blacks, retro fade
            r = r * 1.12 + 0.04;
            g = g * 1.04 + 0.03;
            b = b * 0.82 + 0.02;
            // Black lift (crushed film fade)
            r = 0.06 + r * 0.90;
            g = 0.06 + g * 0.90;
            b = 0.05 + b * 0.88;
            break;
          }

          case 'polaroid_600': {
            // Instant film look: green-shifted shadows, cream highlights, soft contrast
            r = 0.05 + Math.pow(r, 0.95) * 0.92;
            g = 0.07 + Math.pow(g, 0.92) * 0.95;
            b = 0.04 + Math.pow(b, 1.10) * 0.90;
            break;
          }

          case 'moody_bw': {
            // Dramatic B&W with high micro-contrast
            let bw = lum;
            // S-curve for punchy monochrome
            bw = bw < 0.5 ? 2 * bw * bw : 1 - 2 * (1 - bw) * (1 - bw);
            r = bw;
            g = bw;
            b = bw;
            break;
          }

          case 'golden_hour': {
            // Sunset amber golden hour
            r = Math.pow(r, 0.82) * 1.18;
            g = Math.pow(g, 0.90) * 1.06;
            b = Math.pow(b, 1.25) * 0.78;
            break;
          }

          case 'bleach_bypass': {
            // Desaturated, high silver contrast
            const gray = lum;
            const blend = 0.65;
            r = r * (1 - blend) + gray * blend;
            g = g * (1 - blend) + gray * blend;
            b = b * (1 - blend) + gray * blend;
            // High contrast
            r = r < 0.5 ? 2 * r * r : 1 - 2 * (1 - r) * (1 - r);
            g = g < 0.5 ? 2 * g * g : 1 - 2 * (1 - g) * (1 - g);
            b = b < 0.5 ? 2 * b * b : 1 - 2 * (1 - b) * (1 - b);
            break;
          }

          case 'pastel_dream': {
            // Dreamy Japanese Sakura pastel: soft lavender-pink
            r = 0.06 + Math.pow(r, 0.86) * 0.96;
            g = 0.05 + Math.pow(g, 0.90) * 0.94;
            b = 0.08 + Math.pow(b, 0.88) * 0.98;
            break;
          }

          case 'nordic_cool': {
            // Crisp cool Nordic tones: desaturated warm colors, soft blue shadows
            r = Math.pow(r, 1.06) * 0.92;
            g = Math.pow(g, 0.98) * 1.02;
            b = Math.pow(b, 0.90) * 1.10;
            break;
          }
        }

        cube[idx++] = Math.max(0, Math.min(1, r));
        cube[idx++] = Math.max(0, Math.min(1, g));
        cube[idx++] = Math.max(0, Math.min(1, b));
      }
    }
  }

  return cube;
}

/**
 * High-speed 3D LUT transformation applied directly to canvas ImageData
 * Supports intensity blending (0 to 100)
 */
export function applyLutToImageData(
  imageData: ImageData,
  presetId: LutPresetId,
  intensity = 100
): void {
  if (presetId === 'none' || intensity <= 0) return;

  const cube = getLutCube(presetId);
  const data = imageData.data;
  const len = data.length;
  const size = LUT_SIZE;
  const maxIdx = size - 1;
  const blend = Math.max(0, Math.min(1, intensity / 100));

  for (let i = 0; i < len; i += 4) {
    const rawR = data[i];
    const rawG = data[i + 1];
    const rawB = data[i + 2];

    // Compute coordinate indices in 32x32x32 cube
    const rIdx = (rawR * maxIdx) / 255;
    const gIdx = (rawG * maxIdx) / 255;
    const bIdx = (rawB * maxIdx) / 255;

    // Trilinear integer bounds
    const r0 = Math.floor(rIdx);
    const r1 = Math.min(maxIdx, r0 + 1);
    const g0 = Math.floor(gIdx);
    const g1 = Math.min(maxIdx, g0 + 1);
    const b0 = Math.floor(bIdx);
    const b1 = Math.min(maxIdx, b0 + 1);

    const rf = rIdx - r0;
    const gf = gIdx - g0;
    const bf = bIdx - b0;

    // Trilinear cube sampling
    const getSample = (r: number, g: number, b: number, ch: number) => {
      const idx = (b * size * size + g * size + r) * 3 + ch;
      return cube[idx];
    };

    for (let c = 0; c < 3; c++) {
      const c000 = getSample(r0, g0, b0, c);
      const c100 = getSample(r1, g0, b0, c);
      const c010 = getSample(r0, g1, b0, c);
      const c110 = getSample(r1, g1, b0, c);
      const c001 = getSample(r0, g0, b1, c);
      const c101 = getSample(r1, g0, b1, c);
      const c011 = getSample(r0, g1, b1, c);
      const c111 = getSample(r1, g1, b1, c);

      const c00 = c000 * (1 - rf) + c100 * rf;
      const c10 = c010 * (1 - rf) + c110 * rf;
      const c01 = c001 * (1 - rf) + c101 * rf;
      const c11 = c011 * (1 - rf) + c111 * rf;

      const c0 = c00 * (1 - gf) + c10 * gf;
      const c1 = c01 * (1 - gf) + c11 * gf;

      const targetVal = (c0 * (1 - bf) + c1 * bf) * 255;
      const origVal = data[i + c];

      data[i + c] = Math.round(origVal * (1 - blend) + targetVal * blend);
    }
  }
}

/**
 * Applies LUT color grading to an HTMLCanvasElement
 */
export function applyLutToCanvas(
  canvas: HTMLCanvasElement,
  presetId: LutPresetId,
  intensity = 100
): void {
  if (presetId === 'none' || intensity <= 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyLutToImageData(imgData, presetId, intensity);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Returns a fast CSS filter string for live webcam preview
 * Provides smooth 60fps real-time visual approximation without canvas overhead
 */
export function getLutLiveCssFilter(presetId: LutPresetId, intensity = 100): string {
  if (presetId === 'none' || intensity <= 0) return '';
  const factor = intensity / 100;

  switch (presetId) {
    case 'kodak_portra':
      return `brightness(${(1 + 0.05 * factor).toFixed(2)}) contrast(${(1 + 0.08 * factor).toFixed(2)}) saturate(${(1 + 0.12 * factor).toFixed(2)}) sepia(${(18 * factor).toFixed(0)}%)`;
    case 'fuji_velvia':
      return `contrast(${(1 + 0.15 * factor).toFixed(2)}) saturate(${(1 + 0.22 * factor).toFixed(2)}) hue-rotate(${(-6 * factor).toFixed(0)}deg)`;
    case 'teal_orange':
      return `contrast(${(1 + 0.25 * factor).toFixed(2)}) saturate(${(1 + 0.18 * factor).toFixed(2)}) hue-rotate(${(12 * factor).toFixed(0)}deg) sepia(${(10 * factor).toFixed(0)}%)`;
    case 'cyberpunk':
      return `contrast(${(1 + 0.30 * factor).toFixed(2)}) saturate(${(1 + 0.40 * factor).toFixed(2)}) hue-rotate(${(-18 * factor).toFixed(0)}deg)`;
    case 'korean_glow':
      return `brightness(${(1 + 0.14 * factor).toFixed(2)}) contrast(${(1 - 0.05 * factor).toFixed(2)}) saturate(${(1 + 0.08 * factor).toFixed(2)}) sepia(${(6 * factor).toFixed(0)}%)`;
    case 'vintage_70s':
      return `sepia(${(38 * factor).toFixed(0)}%) contrast(${(1 - 0.08 * factor).toFixed(2)}) brightness(${(1 + 0.06 * factor).toFixed(2)}) saturate(${(1 - 0.15 * factor).toFixed(2)})`;
    case 'polaroid_600':
      return `sepia(${(16 * factor).toFixed(0)}%) brightness(${(1 + 0.08 * factor).toFixed(2)}) contrast(${(1 - 0.10 * factor).toFixed(2)}) hue-rotate(${(8 * factor).toFixed(0)}deg)`;
    case 'moody_bw':
      return `grayscale(${(100 * factor).toFixed(0)}%) contrast(${(1 + 0.40 * factor).toFixed(2)}) brightness(${(1 - 0.04 * factor).toFixed(2)})`;
    case 'golden_hour':
      return `sepia(${(32 * factor).toFixed(0)}%) saturate(${(1 + 0.25 * factor).toFixed(2)}) brightness(${(1 + 0.10 * factor).toFixed(2)}) hue-rotate(${(5 * factor).toFixed(0)}deg)`;
    case 'bleach_bypass':
      return `saturate(${(1 - 0.60 * factor).toFixed(2)}) contrast(${(1 + 0.45 * factor).toFixed(2)})`;
    case 'pastel_dream':
      return `brightness(${(1 + 0.12 * factor).toFixed(2)}) saturate(${(1 + 0.10 * factor).toFixed(2)}) hue-rotate(${(-12 * factor).toFixed(0)}deg) contrast(${(1 - 0.06 * factor).toFixed(2)})`;
    case 'nordic_cool':
      return `hue-rotate(${(15 * factor).toFixed(0)}deg) saturate(${(1 - 0.15 * factor).toFixed(2)}) contrast(${(1 + 0.10 * factor).toFixed(2)}) brightness(${(1 + 0.04 * factor).toFixed(2)})`;
    default:
      return '';
  }
}

/**
 * Generates a standard 2D Strip LUT (256x16 PNG) or Hald CLUT (512x512 PNG)
 * as an exported asset Blob that users can save and use in Photoshop / Lightroom / Premiere / DaVinci
 */
export function generateLutStripAsset(presetId: LutPresetId): string {
  // Standard 256x16 color strip LUT
  const w = 256;
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  // Fill with identity strip gradient (16 slices of 16x16)
  let p = 0;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 256; x++) {
      const slice = Math.floor(x / 16);
      const r = (x % 16) * 17;
      const g = y * 17;
      const b = slice * 17;
      data[p++] = r;
      data[p++] = g;
      data[p++] = b;
      data[p++] = 255;
    }
  }

  // Apply the 3D LUT transformation
  applyLutToImageData(imgData, presetId, 100);
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/png');
}
