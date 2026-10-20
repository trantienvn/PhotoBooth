import type { TemplateConfig, TemplateCategory, TemplatePhotoSlot } from '@/types';

// ============================================================
// Helper to generate strip slots (vertical strip)
// ============================================================
function makeStripSlots(count: number, padding: number, gap: number, canvasW: number, canvasH: number): TemplatePhotoSlot[] {
  const totalGap = gap * (count - 1);
  const totalPad = padding * 2;
  const availH = canvasH - totalPad - totalGap;
  const slotH = availH / count;
  const slotW = canvasW - totalPad;

  return Array.from({ length: count }, (_, i) => ({
    x: padding / canvasW,
    y: (padding + i * (slotH + gap)) / canvasH,
    width: slotW / canvasW,
    height: slotH / canvasH,
    borderRadius: 4,
  }));
}

// ============================================================
// Helper to generate grid slots
// ============================================================
function makeGridSlots(
  cols: number,
  rows: number,
  padding: number,
  gap: number,
  canvasW: number,
  canvasH: number,
): TemplatePhotoSlot[] {
  const totalGapX = gap * (cols - 1);
  const totalGapY = gap * (rows - 1);
  const totalPad = padding * 2;
  const slotW = (canvasW - totalPad - totalGapX) / cols;
  const slotH = (canvasH - totalPad - totalGapY) / rows;

  const slots: TemplatePhotoSlot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: (padding + c * (slotW + gap)) / canvasW,
        y: (padding + r * (slotH + gap)) / canvasH,
        width: slotW / canvasW,
        height: slotH / canvasH,
        borderRadius: 4,
      });
    }
  }
  return slots;
}

// ============================================================
// Template Definitions
// ============================================================
export const templates: TemplateConfig[] = [
  // ── Classic Photostrip 3 ────────────────────────────────
  {
    id: 'classic-strip-3',
    name: 'Classic Strip 3',
    category: 'classic',
    photoCount: 3,
    canvasWidth: 400,
    canvasHeight: 1200,
    backgroundColor: '#ffffff',
    slots: makeStripSlots(3, 20, 12, 400, 1150),
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 20,
    gap: 12,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['strip', 'classic', 'portrait'],
    description: 'Classic vertical strip with 3 photos',
  },
  // ── Classic Photostrip 4 ────────────────────────────────
  {
    id: 'classic-strip-4',
    name: 'Classic Strip 4',
    category: 'classic',
    photoCount: 4,
    canvasWidth: 400,
    canvasHeight: 1500,
    backgroundColor: '#ffffff',
    slots: makeStripSlots(4, 20, 12, 400, 1450),
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 20,
    gap: 12,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['strip', 'classic', 'portrait'],
    description: 'Classic vertical strip with 4 photos',
  },
  // ── Classic Photostrip 5 ────────────────────────────────
  {
    id: 'classic-strip-5',
    name: 'Classic Strip 5',
    category: 'classic',
    photoCount: 5,
    canvasWidth: 400,
    canvasHeight: 1850,
    backgroundColor: '#ffffff',
    slots: makeStripSlots(5, 20, 10, 400, 1800),
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 20,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['strip', 'classic', 'portrait'],
    description: 'Classic vertical strip with 5 photos',
  },
  // ── Korean Photobooth 4 ──────────────────────────────────
  {
    id: 'korean-4',
    name: 'Korean Booth 4',
    category: 'korean',
    photoCount: 4,
    canvasWidth: 400,
    canvasHeight: 1500,
    backgroundColor: '#fff0f6',
    slots: makeStripSlots(4, 20, 10, 400, 1450),
    borderColor: '#f9a8d4',
    borderWidth: 2,
    padding: 20,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['korean', 'strip', 'cute'],
    description: 'Korean-style pink strip',
  },
  // ── Korean Photobooth 6 ──────────────────────────────────
  {
    id: 'korean-6',
    name: 'Korean Booth 6',
    category: 'korean',
    photoCount: 6,
    canvasWidth: 400,
    canvasHeight: 2100,
    backgroundColor: '#f0fdf4',
    slots: makeStripSlots(6, 20, 10, 400, 2040),
    borderColor: '#86efac',
    borderWidth: 2,
    padding: 20,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['korean', 'strip'],
    description: 'Korean-style green strip with 6 photos',
  },
  // ── Retro Film 4 ────────────────────────────────────────
  {
    id: 'retro-film-4',
    name: 'Retro Film 4',
    category: 'retro',
    photoCount: 4,
    canvasWidth: 420,
    canvasHeight: 1520,
    backgroundColor: '#1c1917',
    backgroundPattern: 'film',
    slots: makeStripSlots(4, 30, 8, 420, 1460),
    borderColor: '#78716c',
    borderWidth: 3,
    padding: 30,
    gap: 8,
    hasDateArea: true,
    hasCaptionArea: false,
    hasWatermark: true,
    tags: ['retro', 'film', 'dark'],
    description: 'Dark retro film strip',
  },
  // ── Polaroid 1 ──────────────────────────────────────────
  {
    id: 'polaroid-1',
    name: 'Polaroid Single',
    category: 'polaroid',
    photoCount: 1,
    canvasWidth: 600,
    canvasHeight: 700,
    backgroundColor: '#ffffff',
    slots: [{ x: 40/600, y: 40/700, width: 520/600, height: 520/700, borderRadius: 2 }],
    borderColor: '#d1d5db',
    borderWidth: 1,
    padding: 40,
    gap: 0,
    hasDateArea: false,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['polaroid', 'single'],
    description: 'Polaroid-style single photo',
  },
  // ── Polaroid 4 ──────────────────────────────────────────
  {
    id: 'polaroid-4',
    name: 'Polaroid Grid 4',
    category: 'polaroid',
    photoCount: 4,
    canvasWidth: 900,
    canvasHeight: 900,
    backgroundColor: '#fafaf9',
    slots: makeGridSlots(2, 2, 40, 15, 900, 900),
    borderColor: '#d1d5db',
    borderWidth: 1,
    padding: 40,
    gap: 15,
    hasDateArea: false,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['polaroid', 'grid', 'square'],
    description: '2x2 Polaroid grid',
  },
  // ── Minimal White 4 ─────────────────────────────────────
  {
    id: 'minimal-4',
    name: 'Minimal White 4',
    category: 'minimal',
    photoCount: 4,
    canvasWidth: 800,
    canvasHeight: 1100,
    backgroundColor: '#ffffff',
    slots: makeGridSlots(2, 2, 30, 10, 800, 1040),
    borderColor: 'transparent',
    borderWidth: 0,
    padding: 30,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['minimal', 'white', 'clean'],
    description: 'Clean minimal layout',
  },
  // ── Pastel Grid 6 ───────────────────────────────────────
  {
    id: 'pastel-6',
    name: 'Pastel Grid 6',
    category: 'pastel',
    photoCount: 6,
    canvasWidth: 900,
    canvasHeight: 650,
    backgroundColor: '#fdf4ff',
    slots: makeGridSlots(3, 2, 20, 10, 900, 650),
    borderColor: '#e879f9',
    borderWidth: 2,
    padding: 20,
    gap: 10,
    hasDateArea: false,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['pastel', 'grid', 'colorful'],
    description: 'Pastel horizontal grid',
  },
  // ── Birthday 4 ──────────────────────────────────────────
  {
    id: 'birthday-4',
    name: 'Birthday 4',
    category: 'birthday',
    photoCount: 4,
    canvasWidth: 800,
    canvasHeight: 1100,
    backgroundColor: '#fffbeb',
    backgroundPattern: 'confetti',
    slots: makeGridSlots(2, 2, 40, 15, 800, 1040),
    borderColor: '#fbbf24',
    borderWidth: 3,
    padding: 40,
    gap: 15,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['birthday', 'celebration', 'fun'],
    description: 'Birthday celebration layout',
  },
  // ── Couple 2 ────────────────────────────────────────────
  {
    id: 'couple-2',
    name: 'Couple',
    category: 'couple',
    photoCount: 2,
    canvasWidth: 800,
    canvasHeight: 500,
    backgroundColor: '#fff1f2',
    slots: makeGridSlots(2, 1, 30, 15, 800, 500),
    borderColor: '#fb7185',
    borderWidth: 2,
    padding: 30,
    gap: 15,
    hasDateArea: false,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['couple', 'romantic'],
    description: 'Side-by-side couple layout',
  },
  // ── Collage Grid 9 ──────────────────────────────────────
  {
    id: 'collage-9',
    name: 'Collage 9',
    category: 'collage',
    photoCount: 9,
    canvasWidth: 900,
    canvasHeight: 900,
    backgroundColor: '#f8fafc',
    slots: makeGridSlots(3, 3, 10, 5, 900, 900),
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 10,
    gap: 5,
    hasDateArea: false,
    hasCaptionArea: false,
    hasWatermark: true,
    tags: ['collage', 'grid', 'many'],
    description: '3x3 photo grid',
  },
  // ── Collage Grid 12 ─────────────────────────────────────
  {
    id: 'collage-12',
    name: 'Collage 12',
    category: 'collage',
    photoCount: 12,
    canvasWidth: 1200,
    canvasHeight: 900,
    backgroundColor: '#f8fafc',
    slots: makeGridSlots(4, 3, 10, 5, 1200, 900),
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 10,
    gap: 5,
    hasDateArea: false,
    hasCaptionArea: false,
    hasWatermark: true,
    tags: ['collage', 'grid', 'many'],
    description: '4x3 photo grid',
  },
  // ── Vintage 4 ───────────────────────────────────────────
  {
    id: 'vintage-4',
    name: 'Vintage 4',
    category: 'vintage',
    photoCount: 4,
    canvasWidth: 420,
    canvasHeight: 1500,
    backgroundColor: '#fef3c7',
    slots: makeStripSlots(4, 25, 10, 420, 1440),
    borderColor: '#d97706',
    borderWidth: 3,
    padding: 25,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['vintage', 'warm', 'strip'],
    description: 'Warm vintage strip',
  },
  // ── Friendship 6 ────────────────────────────────────────
  {
    id: 'friendship-6',
    name: 'Friendship 6',
    category: 'friendship',
    photoCount: 6,
    canvasWidth: 1000,
    canvasHeight: 700,
    backgroundColor: '#ecfeff',
    slots: makeGridSlots(3, 2, 25, 12, 1000, 700),
    borderColor: '#67e8f9',
    borderWidth: 2,
    padding: 25,
    gap: 12,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: false,
    tags: ['friendship', 'fun', 'group'],
    description: 'Friendship memories layout',
  },
  // ── Classic strip 8 ─────────────────────────────────────
  {
    id: 'classic-strip-8',
    name: 'Classic Strip 8',
    category: 'classic',
    photoCount: 8,
    canvasWidth: 400,
    canvasHeight: 2800,
    backgroundColor: '#ffffff',
    slots: makeStripSlots(8, 20, 10, 400, 2750),
    borderColor: '#e5e7eb',
    borderWidth: 1,
    padding: 20,
    gap: 10,
    hasDateArea: true,
    hasCaptionArea: true,
    hasWatermark: true,
    tags: ['strip', 'classic', 'long'],
    description: 'Long classic strip with 8 photos',
  },
];

/** Get templates compatible with a given photo count */
export function getCompatibleTemplates(photoCount: number): TemplateConfig[] {
  return templates.filter((t) => t.photoCount === photoCount);
}

/** Get templates by category */
export function getTemplatesByCategory(category: TemplateCategory): TemplateConfig[] {
  return templates.filter((t) => t.category === category);
}

/** Get a template by ID */
export function getTemplateById(id: string): TemplateConfig | undefined {
  return templates.find((t) => t.id === id);
}

/** Suggest a template when count doesn't match */
export function suggestTemplates(photoCount: number): TemplateConfig[] {
  const exact = getCompatibleTemplates(photoCount);
  if (exact.length > 0) return exact;
  // Find closest match
  const sorted = [...templates].sort((a, b) =>
    Math.abs(a.photoCount - photoCount) - Math.abs(b.photoCount - photoCount)
  );
  return sorted.slice(0, 3);
}

export const templateCategories: { id: TemplateCategory; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'korean', label: 'Korean' },
  { id: 'retro', label: 'Retro' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'pastel', label: 'Pastel' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'couple', label: 'Couple' },
  { id: 'friendship', label: 'Friendship' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'collage', label: 'Collage' },
];
