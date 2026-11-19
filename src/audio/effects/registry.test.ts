vi.mock('tone', () => ({}));
import {
  FX_DEFS,
  FX_ORDER,
  allParams,
  defaultParams,
  cutoffHz,
  crushBits,
  downFactor,
  DELAY_LABELS,
  choiceIndex,
} from './registry';
import { TIPS } from '@/ui/tooltips';

describe('effect registry', () => {
  it('has all 8 effects, each with 1–2 main knobs and in-range defaults', () => {
    expect(FX_ORDER).toHaveLength(8);
    for (const t of FX_ORDER) {
      const d = FX_DEFS[t];
      expect(d.main.length).toBeGreaterThanOrEqual(1);
      expect(d.main.length).toBeLessThanOrEqual(2);
      for (const p of allParams(d)) {
        expect(p.default).toBeGreaterThanOrEqual(0);
        expect(p.default).toBeLessThanOrEqual(1);
        expect(typeof p.format(p.default)).toBe('string');
        if (!p.choices) expect(TIPS[`fx.${t}.${p.key}`] ?? p.tip).toBeTruthy();
      }
      expect(Object.keys(defaultParams(t))).toEqual(allParams(d).map((p) => p.key));
    }
  });
  it('maps knob endpoints to useful ranges', () => {
    expect(cutoffHz(0)).toBeCloseTo(40);
    expect(cutoffHz(1)).toBeCloseTo(18000);
    expect(crushBits(0)).toBe(16);
    expect(crushBits(1)).toBe(2);
    expect(downFactor(1)).toBe(20);
    expect(DELAY_LABELS[choiceIndex(0.4, 6)]).toBe('3/16');
  });
});
