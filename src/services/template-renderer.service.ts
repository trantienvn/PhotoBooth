import type { TemplateConfig, Photo, PhotoEditState, ExportOptions, PhotostripDecoration, Layer, TextLayer, EmojiLayer } from '@/types';
import { applyFiltersToCanvas } from './image-processing.service';

export interface RenderResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
}

/**
 * Load an image from a data URL, returns HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Apply photo edit state (filters + crop) to a canvas
 */
async function renderPhoto(
  photo: Photo,
  editState: PhotoEditState | undefined,
  slotPixelW: number,
  slotPixelH: number,
): Promise<HTMLCanvasElement> {
  const srcUrl = photo.editedDataUrl ?? photo.dataUrl;
  const img = await loadImage(srcUrl);

  const canvas = document.createElement('canvas');
  canvas.width = slotPixelW;
  canvas.height = slotPixelH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const crop = editState?.crop;
  const flipH = crop?.flipH ?? false;
  const rotation = crop?.rotation ?? 0;

  // Save context state
  ctx.save();
  ctx.translate(slotPixelW / 2, slotPixelH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  if (flipH) ctx.scale(-1, 1);

  // Draw image centered with cover fit
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const slotAspect = slotPixelW / slotPixelH;
  let drawW: number, drawH: number;
  if (imgAspect > slotAspect) {
    drawH = slotPixelH;
    drawW = drawH * imgAspect;
  } else {
    drawW = slotPixelW;
    drawH = drawW / imgAspect;
  }

  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  // Apply filters & 3D LUT Color Grading
  if (editState?.filter || (editState?.lutId && editState.lutId !== 'none')) {
    const filtered = applyFiltersToCanvas(
      canvas,
      editState?.filter ?? {
        brightness: 0, contrast: 0, saturation: 0, exposure: 0,
        warmth: 0, tint: 0, highlights: 0, shadows: 0,
        fade: 0, vignette: 0, grain: 0, sharpness: 0,
      },
      slotPixelW,
      slotPixelH,
      editState?.lutId,
      editState?.lutIntensity
    );
    return filtered;
  }
  return canvas;
}

/**
 * Render border radius clipping path on a ctx
 */
function clipRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Render decoration layers (text, stickers, emoji) onto the canvas
 */
function renderLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  scale: number = 1,
): void {
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of sorted) {
    const px = layer.x * canvasW;
    const py = layer.y * canvasH;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);

    if (layer.type === 'text') {
      const tl = layer as TextLayer;
      const fSize = Math.max(8, Math.round(tl.fontSize * scale));
      ctx.font = `${tl.italic ? 'italic ' : ''}${tl.bold ? 'bold ' : ''}${fSize}px ${tl.fontFamily || 'Inter, sans-serif'}`;
      ctx.fillStyle = tl.color;
      ctx.textAlign = tl.align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tl.content, 0, 0);
    } else if (layer.type === 'emoji') {
      const el = layer as EmojiLayer;
      const fSize = Math.max(12, Math.round(el.fontSize * scale));
      ctx.font = `${fSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(el.emoji, 0, 0);
    }
    ctx.restore();
  }
}

/**
 * Main template renderer — renders photos into a template layout
 */
export async function renderTemplate(
  template: TemplateConfig,
  photos: Photo[],
  editStates: Map<string, PhotoEditState>,
  decoration: PhotostripDecoration,
  options: ExportOptions,
  onProgress?: (progress: number) => void,
): Promise<RenderResult> {
  const scale = options.scale;
  const canvasW = template.canvasWidth * scale;
  const canvasH = template.canvasHeight * scale;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Background
  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Background pattern
  if (template.backgroundPattern === 'film') {
    // Film sprocket holes
    ctx.fillStyle = '#2d2826';
    for (let y = 20; y < canvasH; y += 40) {
      ctx.fillRect(0, y * scale, 18 * scale, 22 * scale);
      ctx.fillRect((canvasW - 18 * scale), y * scale, 18 * scale, 22 * scale);
    }
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(20 * scale, 0, canvasW - 40 * scale, canvasH);
  }

  // Draw photos in slots
  const slots = template.slots;
  const photosToDraw = photos.slice(0, slots.length);

  for (let i = 0; i < photosToDraw.length; i++) {
    const photo = photosToDraw[i];
    const slot = slots[i];
    const slotX = slot.x * canvasW;
    const slotY = slot.y * canvasH;
    const slotW = slot.width * canvasW;
    const slotH = slot.height * canvasH;
    const radius = (slot.borderRadius ?? 0) * scale;

    const editState = editStates.get(photo.id);
    const photoCanvas = await renderPhoto(photo, editState, Math.round(slotW), Math.round(slotH));

    ctx.save();
    if (radius > 0) {
      clipRoundedRect(ctx, slotX, slotY, slotW, slotH, radius);
      ctx.clip();
    }
    ctx.drawImage(photoCanvas, slotX, slotY, slotW, slotH);
    ctx.restore();

    // Border
    if (template.borderWidth && template.borderColor && template.borderColor !== 'transparent') {
      ctx.strokeStyle = template.borderColor;
      ctx.lineWidth = template.borderWidth * scale;
      if (radius > 0) {
        ctx.beginPath();
        clipRoundedRect(ctx, slotX, slotY, slotW, slotH, radius);
        ctx.stroke();
      } else {
        ctx.strokeRect(slotX, slotY, slotW, slotH);
      }
    }

    onProgress?.((i + 1) / photosToDraw.length);
  }

  // Date area
  if (template.hasDateArea && decoration.showDate && decoration.dateLine) {
    ctx.fillStyle = template.backgroundColor === '#1c1917' ? '#a8a29e' : '#6b7280';
    ctx.font = `${12 * scale}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(decoration.dateLine, canvasW / 2, canvasH - 6 * scale);
  }

  // Caption area
  if (template.hasCaptionArea && decoration.showCaption && decoration.caption) {
    const isBottom = (template.slots[template.slots.length - 1]?.y ?? 0) > 0.5;
    const captionY = isBottom ? canvasH - 25 * scale : 25 * scale;
    ctx.fillStyle = template.backgroundColor === '#1c1917' ? '#fafaf9' : '#111827';
    ctx.font = `bold ${14 * scale}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(decoration.caption, canvasW / 2, captionY);
  }

  // Watermark
  if (template.hasWatermark && options.includeWatermark) {
    ctx.fillStyle = 'rgba(100,100,100,0.4)';
    ctx.font = `${9 * scale}px Inter, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('LumiBooth', canvasW - 8 * scale, canvasH - 4 * scale);
  }

  // Decoration layers
  if (decoration.layers.length > 0) {
    renderLayers(ctx, decoration.layers, canvasW, canvasH, scale);
  }

  const mimeType = options.format === 'png' ? 'image/png'
    : options.format === 'webp' ? 'image/webp'
    : 'image/jpeg';

  const dataUrl = canvas.toDataURL(mimeType, options.quality);
  return { canvas, dataUrl };
}

/**
 * Generate a thumbnail preview of a template (no real photos needed)
 */
export function renderTemplateThumbnail(template: TemplateConfig, size = 120): string {
  const aspect = template.canvasHeight / template.canvasWidth;
  const w = size;
  const h = Math.round(size * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = template.backgroundColor;
  ctx.fillRect(0, 0, w, h);

  for (const slot of template.slots) {
    const sx = slot.x * w;
    const sy = slot.y * h;
    const sw = slot.width * w;
    const sh = slot.height * h;
    ctx.fillStyle = '#d1d5db';
    if ((slot.borderRadius ?? 0) > 0) {
      const r = Math.min((slot.borderRadius ?? 0), sw / 4, sh / 4);
      clipRoundedRect(ctx, sx, sy, sw, sh, r);
      ctx.fill();
    } else {
      ctx.fillRect(sx, sy, sw, sh);
    }
    // Camera icon placeholder
    ctx.fillStyle = '#9ca3af';
    ctx.font = `${Math.min(sw, sh) * 0.4}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📷', sx + sw / 2, sy + sh / 2);
  }

  if (template.borderColor && template.borderColor !== 'transparent') {
    ctx.strokeStyle = template.borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  return canvas.toDataURL('image/png');
}
