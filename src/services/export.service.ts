import type { Photo, ExportOptions, ExportFormat } from '@/types';

/**
 * Download a data URL as a file
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Download a blob URL as a file
 */
export function downloadBlobUrl(blobUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
}

/**
 * Export a single photo with given options
 */
export async function exportSinglePhoto(
  photo: Photo,
  options: ExportOptions,
): Promise<string> {
  const img = await loadImage(photo.editedDataUrl ?? photo.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth * options.scale;
  canvas.height = img.naturalHeight * options.scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const mimeType = getMimeType(options.format);
  return canvas.toDataURL(mimeType, options.quality);
}

/**
 * Download all photos as a ZIP file (requires jszip)
 */
export async function downloadAllAsZip(
  photos: Photo[],
  sessionId: string,
  format: ExportFormat = 'jpeg',
  _quality = 0.92,
): Promise<void> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const ext = format;

    for (const photo of photos) {
      const dataUrl = photo.editedDataUrl ?? photo.dataUrl;
      // Convert data URL to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      zip.file(`lumibooth_${sessionId.slice(-6)}_${String(photo.index + 1).padStart(2, '0')}.${ext}`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      console.log('Zipping:', Math.round(meta.percent) + '%');
    });

    const url = URL.createObjectURL(zipBlob);
    downloadBlobUrl(url, `lumibooth_${sessionId.slice(-6)}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    console.error('ZIP export failed:', err);
    throw err;
  }
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    default: return 'image/jpeg';
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Check if WebP is supported
 */
export function isWebPSupported(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format ms to mm:ss
 */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
