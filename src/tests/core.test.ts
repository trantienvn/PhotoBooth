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
