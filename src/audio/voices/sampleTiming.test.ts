import { computeHitTiming } from './sampleTiming';
import { DEFAULT_SAMPLE_EDIT } from '@/model/factories';

const E = (p: Partial<typeof DEFAULT_SAMPLE_EDIT> = {}) => ({ ...DEFAULT_SAMPLE_EDIT, ...p });

describe('computeHitTiming', () => {
  it('plays the whole sample by default', () => {
    expect(computeHitTiming(E(), 2, 1)).toMatchObject({
      offset: 0,
      playDur: 2,
      loop: false,
      fadeStart: 2,
    });
  });
  it('trims and accounts for playback rate', () => {
    const t = computeHitTiming(E({ start: 0.25, end: 0.75 }), 2, 2);
    expect(t.offset).toBeCloseTo(0.5);
    expect(t.playDur).toBeCloseTo(0.5);
  });
  it('mirrors the region when reversed', () => {
    const t = computeHitTiming(E({ start: 0.1, end: 0.5, reverse: true }), 1, 1);
    expect(t.offset).toBeCloseTo(0.5);
    expect(t.playDur).toBeCloseTo(0.4);
  });
  it('cuts melodic notes at the hold time', () => {
    expect(computeHitTiming(E(), 2, 1, 0.3).playDur).toBeCloseTo(0.3);
  });
  it('loops for the whole hold, between loop point and end', () => {
    const t = computeHitTiming(E({ loop: true, loopStart: 0.4, end: 0.9 }), 1, 1, 3);
    expect(t).toMatchObject({ loop: true, playDur: 3 });
    expect(t.loopStart).toBeCloseTo(0.4);
    expect(t.loopEnd).toBeCloseTo(0.9);
  });
  it('fades the last part of the hit', () => {
    expect(computeHitTiming(E({ fadeOut: 0.5 }), 2, 1).fadeStart).toBeCloseTo(1);
  });
});
