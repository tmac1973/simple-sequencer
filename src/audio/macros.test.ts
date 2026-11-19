import { resolveSynthParams, toneToHz, spaceToWet } from './macros';
import { getPreset, PRESETS } from './synthPresets';
import { DEFAULT_MACROS } from '@/model/factories';

describe('synth macros', () => {
  it('maps endpoints as documented', () => {
    expect(toneToHz(0)).toBeCloseTo(200);
    expect(toneToHz(1)).toBeCloseTo(12000);
    expect(spaceToWet(1)).toBeCloseTo(0.45);
    const p = getPreset('warm-bass');
    const lo = resolveSynthParams(p, { tone: 0, punch: 0, space: 0, length: 0 }, {});
    const hi = resolveSynthParams(p, { tone: 1, punch: 1, space: 1, length: 1 }, {});
    expect(lo.attack).toBeCloseTo(p.attackRange[0]);
    expect(hi.attack).toBeCloseTo(p.attackRange[1]);
    expect(lo.filterEnvAmount).toBe(0);
    expect(hi.filterEnvAmount).toBe(3);
    expect(hi.decay).toBeCloseTo(2 * p.lengthScale);
    expect(hi.release).toBeCloseTo(3 * p.lengthScale);
  });
  it('advanced settings override macro values', () => {
    const r = resolveSynthParams(getPreset('soft-pad'), DEFAULT_MACROS, {
      attack: 1.5,
      oscType: 'square',
    });
    expect(r.attack).toBe(1.5);
    expect(r.oscType).toBe('square');
  });
  it('has 10 distinct presets', () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(10);
  });
});
