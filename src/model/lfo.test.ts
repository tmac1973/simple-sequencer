import { cloneTrackWithNewIds, createLane, createSynthTrack, createSong } from './factories';
import { cyclesAt, LFO_RATES, lfoValue, shapeAt } from './lfo';
import { validateSong } from './schema';
import type { AutomationLane, Track } from './types';
import { decodeShare, encodeShare } from '@/storage/shareLink';

function wobbleTrack(
  lfo: AutomationLane['lfo'],
  extra: (l: AutomationLane) => AutomationLane[] = () => [],
) {
  const t = createSynthTrack();
  const lane = { ...createLane({ kind: 'synthMacro', macro: 'tone' }), mode: 'lfo' as const, lfo };
  t.automation = [lane, ...extra(lane)];
  return { t, lane };
}

describe('wobble (LFO) maths', () => {
  it('draws each shape', () => {
    expect(shapeAt('sine', 0.25)).toBeCloseTo(1);
    expect(shapeAt('sine', 0.75)).toBeCloseTo(-1);
    expect(shapeAt('triangle', 0)).toBeCloseTo(0);
    expect(shapeAt('triangle', 0.25)).toBeCloseTo(1);
    expect(shapeAt('triangle', 0.75)).toBeCloseTo(-1);
    expect(shapeAt('square', 0.1)).toBe(1);
    expect(shapeAt('square', 0.6)).toBe(-1);
    expect(shapeAt('rampUp', 0.5)).toBeCloseTo(0);
    expect(shapeAt('rampDown', 0)).toBeCloseTo(1);
    // random: the same within a cycle and for the same lane, different between cycles
    expect(shapeAt('random', 3.1, 'a')).toBe(shapeAt('random', 3.9, 'a'));
    const vals = Array.from({ length: 16 }, (_, n) => shapeAt('random', n, 'a'));
    expect(new Set(vals).size).toBeGreaterThan(12);
    for (const v of vals) expect(Math.abs(v)).toBeLessThanOrEqual(1);
  });

  it('swings around the centre, in time with the beat, and stays in range', () => {
    const { t, lane } = wobbleTrack({ shape: 'sine', rate: 2, depth: 0.6, center: 0.5 }); // 1 beat
    expect(lfoValue(t, lane, 0)).toBeCloseTo(0.5);
    expect(lfoValue(t, lane, 0.25)).toBeCloseTo(0.8);
    expect(lfoValue(t, lane, 0.75)).toBeCloseTo(0.2);
    expect(lfoValue(t, lane, 7.25)).toBeCloseTo(0.8);
    lane.lfo = { shape: 'square', rate: 2, depth: 1, center: 0.9 };
    expect(lfoValue(t, lane, 0.1)).toBe(1);
    expect(lfoValue(t, lane, 0.6)).toBeCloseTo(0.4);
  });

  it('an amount lane fades the wobble in', () => {
    const { t, lane } = wobbleTrack({ shape: 'sine', rate: 2, depth: 1, center: 0.5 }, (l) => [
      createLane({ kind: 'lfo', laneId: l.id, param: 'amount' }, [
        { bar: 0, value: 0 },
        { bar: 2, value: 1 },
      ]),
    ]);
    // at the top of each wobble the knob is centre + amount/2, and the amount rises over 2 bars
    const top = (beat: number) => 0.5 + 0.5 * Math.min(1, beat / 4 / 2);
    for (const beat of [0.25, 2.25, 4.25, 6.25, 8.25])
      expect(lfoValue(t, lane, beat)).toBeCloseTo(top(beat));
  });

  it('a speed lane changes the speed without jumping', () => {
    const { t, lane } = wobbleTrack({ shape: 'rampUp', rate: 2, depth: 1, center: 0.5 }, (l) => [
      // 1 beat per cycle for bar 1, then 1/8 notes (2 cycles a beat)
      createLane({ kind: 'lfo', laneId: l.id, param: 'speed' }, [
        { bar: 0, value: 2 / 7 },
        { bar: 1, value: 2 / 7 },
        { bar: 1, value: 1 / 7 },
      ]),
    ]);
    const speed = t.automation[1]!;
    expect(cyclesAt(lane.lfo!, 4, speed)).toBeCloseTo(4);
    expect(cyclesAt(lane.lfo!, 5, speed)).toBeCloseTo(6);
    // continuous across the change
    expect(cyclesAt(lane.lfo!, 3.999, speed)).toBeCloseTo(cyclesAt(lane.lfo!, 4, speed), 2);
    expect(lfoValue(t, lane, 4.25)).toBeCloseTo(0.5); // half way through a fast cycle
    expect(LFO_RATES).toHaveLength(8);
  });

  it('loads old songs, keeps wobble settings in files and links, and remaps copies', () => {
    const { t } = wobbleTrack({ shape: 'triangle', rate: 5, depth: 0.4, center: 0.3 }, (l) => [
      createLane({ kind: 'lfo', laneId: l.id, param: 'amount' }, [{ bar: 0, value: 0.5 }]),
    ]);
    const song = createSong({ tracks: [t as Track] });
    const back = validateSong(JSON.parse(JSON.stringify(song)));
    expect(back.tracks[0]!.automation[0]).toMatchObject({
      mode: 'lfo',
      lfo: { shape: 'triangle', rate: 5, depth: 0.4, center: 0.3 },
    });
    const old = createSong({ tracks: [createSynthTrack()] });
    old.tracks[0]!.automation = [createLane({ kind: 'track', param: 'pan' }, [])];
    expect(
      validateSong(JSON.parse(JSON.stringify(old))).tracks[0]!.automation[0]!.mode,
    ).toBeUndefined();

    const linked = decodeShare(encodeShare(song)).tracks[0]!;
    expect(linked.automation[0]).toMatchObject({
      mode: 'lfo',
      lfo: { shape: 'triangle', rate: 5 },
    });
    expect(linked.automation[1]!.target).toEqual({
      kind: 'lfo',
      laneId: linked.automation[0]!.id,
      param: 'amount',
    });

    const copy = cloneTrackWithNewIds(t);
    expect(copy.automation[1]!.target).toMatchObject({ laneId: copy.automation[0]!.id });
    expect(copy.automation[0]!.id).not.toBe(t.automation[0]!.id);
  });
});
