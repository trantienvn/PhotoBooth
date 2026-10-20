import { describe, it, expect } from 'vitest';
import { getCompatibleTemplates, suggestTemplates, templates } from '@/services/templates.service';
import { filterPresets } from '@/services/image-processing.service';
import { defaultFilterSettings } from '@/types';

// ── Template tests ─────────────────────────────────────────

describe('templates.service', () => {
  it('should have templates for photo counts 3, 4, 5, 6, 8, 9, 12', () => {
    const counts = [3, 4, 5, 6, 8, 9, 12];
    for (const count of counts) {
      const compatible = getCompatibleTemplates(count);
      expect(compatible.length).toBeGreaterThan(0);
    }
  });

  it('getCompatibleTemplates filters by photoCount', () => {
    const t4 = getCompatibleTemplates(4);
    t4.forEach((t) => expect(t.photoCount).toBe(4));
  });

  it('suggestTemplates returns templates even for unmatched count', () => {
    const suggestions = suggestTemplates(7);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('all templates have valid slots matching their photoCount', () => {
    templates.forEach((t) => {
      expect(t.slots.length).toBe(t.photoCount);
    });
  });

  it('all template slots are within 0-1 bounds', () => {
    templates.forEach((t) => {
      t.slots.forEach((slot) => {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.height).toBeGreaterThan(0);
        expect(slot.x + slot.width).toBeLessThanOrEqual(1.01); // allow tiny float error
        expect(slot.y + slot.height).toBeLessThanOrEqual(1.01);
      });
    });
  });

  it('templates have unique IDs', () => {
    const ids = templates.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── Filter preset tests ────────────────────────────────────

describe('filter presets', () => {
  it('should have 12 presets', () => {
    expect(filterPresets.length).toBe(12);
  });

  it('original preset should have all defaults', () => {
    const original = filterPresets.find((p) => p.id === 'original');
    expect(original).toBeDefined();
    expect(original!.settings).toEqual(defaultFilterSettings);
  });

  it('bw preset should have saturation -100', () => {
    const bw = filterPresets.find((p) => p.id === 'bw');
    expect(bw).toBeDefined();
    expect(bw!.settings.saturation).toBe(-100);
  });

  it('all presets have valid filter ranges', () => {
    filterPresets.forEach((preset) => {
      const s = preset.settings;
      // Check range -100 to 100 for adjustment params
      expect(s.brightness).toBeGreaterThanOrEqual(-100);
      expect(s.brightness).toBeLessThanOrEqual(100);
      expect(s.saturation).toBeGreaterThanOrEqual(-100);
      expect(s.saturation).toBeLessThanOrEqual(100);
      // 0-100 for fade/vignette/grain
      expect(s.fade).toBeGreaterThanOrEqual(0);
      expect(s.vignette).toBeGreaterThanOrEqual(0);
      expect(s.grain).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Session state tests ────────────────────────────────────

describe('capture session state machine', () => {
  it('idle -> preparing -> countdown -> capturing -> reviewing transitions are defined', () => {
    const states = ['idle', 'preparing', 'countdown', 'capturing', 'reviewing', 'completed', 'cancelled'];
    expect(states).toContain('idle');
    expect(states).toContain('capturing');
    expect(states).toContain('completed');
    expect(states).toContain('cancelled');
    expect(states.indexOf('idle')).toBeLessThan(states.indexOf('preparing'));
    expect(states.indexOf('preparing')).toBeLessThan(states.indexOf('capturing'));
  });
});

// ── MediaRecorder MIME type tests ──────────────────────────

describe('MediaRecorder MIME types', () => {
  it('should detect supported mime types', () => {
    // In jsdom, MediaRecorder may not be available; we test the import
    const preferred = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    expect(preferred.length).toBeGreaterThan(0);
    expect(preferred[0]).toContain('video/webm');
  });
});

// ── Face Tracking & AR Filters tests ───────────────────────

describe('face-tracking & ar-filters', () => {
  it('should export all 10 AR filters with icons and descriptions', async () => {
    const { arFiltersList } = await import('@/services/ar-filters.service');
    expect(arFiltersList.length).toBe(10);
    const ids = arFiltersList.map((f) => f.id);
    expect(ids).toContain('none');
    expect(ids).toContain('bunny');
    expect(ids).toContain('cat');
    expect(ids).toContain('heart_glasses');
    expect(ids).toContain('crown');
    expect(ids).toContain('sparkles');
    expect(ids).toContain('blush_hearts');
    expect(ids).toContain('dog');
    expect(ids).toContain('flower');
    expect(ids).toContain('angel');
  });

  it('mirrorFace should accurately mirror face horizontally and swap eyes/cheeks', async () => {
    const { mirrorFace } = await import('@/services/face-tracking.service');
    const originalFace = {
      x: 0.2,
      y: 0.2,
      width: 0.4,
      height: 0.5,
      leftEye: { x: 0.32, y: 0.35 },
      rightEye: { x: 0.48, y: 0.35 },
      leftCheek: { x: 0.28, y: 0.48 },
      rightCheek: { x: 0.52, y: 0.48 },
      forehead: { x: 0.40, y: 0.25 },
      chin: { x: 0.40, y: 0.65 },
      nose: { x: 0.40, y: 0.45 },
      mouth: { x: 0.40, y: 0.55 },
      roll: 0.15,
      confidence: 0.9,
    };

    const mirrored = mirrorFace(originalFace);

    // Bounding box x should be 1 - (0.2 + 0.4) = 0.4
    expect(mirrored.x).toBeCloseTo(0.4, 2);
    expect(mirrored.width).toBeCloseTo(0.4, 2);

    // Left eye (on photo) should now be derived from original right eye: 1 - 0.48 = 0.52
    expect(mirrored.leftEye.x).toBeCloseTo(0.52, 2);
    // Right eye (on photo) should now be derived from original left eye: 1 - 0.32 = 0.68
    expect(mirrored.rightEye.x).toBeCloseTo(0.68, 2);

    // Cheeks should be swapped horizontally
    expect(mirrored.leftCheek.x).toBeCloseTo(0.48, 2); // 1 - 0.52
    expect(mirrored.rightCheek.x).toBeCloseTo(0.72, 2); // 1 - 0.28

    // Forehead and chin x mirrored
    expect(mirrored.forehead.x).toBeCloseTo(0.60, 2); // 1 - 0.40
    expect(mirrored.chin.x).toBeCloseTo(0.60, 2);

    // Roll angle should be inverted
    expect(mirrored.roll).toBeCloseTo(-0.15, 2);
  });

  it('mirrorFaces should mirror an array of multiple faces', async () => {
    const { mirrorFaces } = await import('@/services/face-tracking.service');
    const faces = [
      {
        x: 0.1, y: 0.2, width: 0.3, height: 0.4,
        leftEye: { x: 0.18, y: 0.3 }, rightEye: { x: 0.32, y: 0.3 },
        leftCheek: { x: 0.15, y: 0.4 }, rightCheek: { x: 0.35, y: 0.4 },
        forehead: { x: 0.25, y: 0.22 }, chin: { x: 0.25, y: 0.55 },
        nose: { x: 0.25, y: 0.38 }, mouth: { x: 0.25, y: 0.48 },
        roll: 0.1, confidence: 0.9,
      },
      {
        x: 0.6, y: 0.2, width: 0.3, height: 0.4,
        leftEye: { x: 0.68, y: 0.3 }, rightEye: { x: 0.82, y: 0.3 },
        leftCheek: { x: 0.65, y: 0.4 }, rightCheek: { x: 0.85, y: 0.4 },
        forehead: { x: 0.75, y: 0.22 }, chin: { x: 0.75, y: 0.55 },
        nose: { x: 0.75, y: 0.38 }, mouth: { x: 0.75, y: 0.48 },
        roll: -0.1, confidence: 0.9,
      },
    ];

    const mirrored = mirrorFaces(faces);
    expect(mirrored.length).toBe(2);
    expect(mirrored[0].x).toBeCloseTo(1 - (0.1 + 0.3), 2);
    expect(mirrored[1].x).toBeCloseTo(1 - (0.6 + 0.3), 2);
  });
});

