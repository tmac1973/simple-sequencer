import { valueAt, pointsBetween, pruneLanes, targetStatic } from './automation';
import { createFxSlot, createLane, createSampleTrack } from './factories';

const lane = (pts: [number, number][]) =>
  createLane(
    { kind: 'track', param: 'volume' },
    pts.map(([bar, value]) => ({ bar, value })),
  );

describe('automation values', () => {
  it('interpolates linearly and holds at the ends', () => {
    const l = lane([
      [2, 0],
      [4, 1],
    ]);
    expect(valueAt(l, 0)).toBe(0);
    expect(valueAt(l, 3)).toBeCloseTo(0.5);
    expect(valueAt(l, 10)).toBe(1);
    expect(valueAt(lane([]), 1)).toBeNull();
  });
  it('vertical steps return the later value at the step', () => {
    const l = lane([
      [0, 0.2],
      [4, 0.2],
      [4, 0.9],
      [8, 0.9],
    ]);
    expect(valueAt(l, 3.99)).toBeCloseTo(0.2, 2);
    expect(valueAt(l, 4)).toBe(0.9);
  });
  it('finds points inside a beat window', () => {
    const l = lane([
      [0, 0],
      [0.25, 1],
      [0.5, 0],
    ]);
    expect(pointsBetween(l, 0, 0.25).map((p) => p.bar)).toEqual([0.25]);
  });
  it('prunes lanes of deleted effects and reads static values', () => {
    const t = createSampleTrack();
    const f = createFxSlot('filter', { cutoff: 0.3 });
    t.fx = [f];
    t.automation = [
      createLane({ kind: 'fx', fxId: f.id, param: 'cutoff' }),
      createLane({ kind: 'fx', fxId: 'gone', param: 'x' }),
    ];
    expect(pruneLanes(t)).toHaveLength(1);
    expect(targetStatic(t, { kind: 'fx', fxId: f.id, param: 'cutoff' })).toBe(0.3);
    expect(targetStatic(t, { kind: 'track', param: 'pan' })).toBe(0.5);
  });
});
