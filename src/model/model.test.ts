import { degreeToMidi, SCALES, midiName } from './scale';
import { swingOffsetBeats, blockAt } from './timing';
import { sliderToDb, dbToSlider } from './mixing';
import {
  createPattern,
  createSampleTrack,
  createSong,
  createSynthTrack,
  nextPatternName,
  cloneTrackWithNewIds,
  createFxSlot,
  createLane,
} from './factories';
import { validateSong, migrateSong, SongFormatError } from './schema';
import type { ScaleName } from './types';

describe('scale math', () => {
  it('maps degree 0 to the root in octave 3', () => {
    expect(degreeToMidi(0, { root: 0, scale: 'minor' })).toBe(48);
    expect(degreeToMidi(0, { root: 9, scale: 'minor' })).toBe(57);
  });
  it('wraps degrees across octaves for every scale, including negatives', () => {
    for (const scale of Object.keys(SCALES) as ScaleName[]) {
      const n = SCALES[scale].intervals.length;
      const key = { root: 2, scale };
      expect(degreeToMidi(n, key)).toBe(degreeToMidi(0, key) + 12);
      expect(degreeToMidi(-n, key)).toBe(degreeToMidi(0, key) - 12);
      expect(degreeToMidi(-1, key)).toBe(degreeToMidi(n - 1, key) - 12);
    }
  });
  it('C minor degree 2 is E♭', () => {
    expect(
      midiName(degreeToMidi(2, { root: 0, scale: 'minor' }), { root: 0, scale: 'minor' }),
    ).toBe('E♭3');
  });
  it('key change keeps degrees, so notes stay in key', () => {
    const inC = degreeToMidi(4, { root: 0, scale: 'major' });
    const inG = degreeToMidi(4, { root: 7, scale: 'major' });
    expect(inG - inC).toBe(7);
  });
});

describe('timing', () => {
  it('swings odd 16ths only', () => {
    expect(swingOffsetBeats(0, 16, 0.5)).toBe(0);
    expect(swingOffsetBeats(1, 16, 0.5)).toBeCloseTo(0.0625);
    expect(swingOffsetBeats(1, 24, 0.5)).toBe(0);
  });
  it('blockAt resolves later blocks cutting off earlier ones', () => {
    const t = createSampleTrack();
    const a = t.patterns[0]!;
    a.lengthBars = 4;
    const b = createPattern({ name: 'B' });
    t.patterns.push(b);
    t.blocks = [
      { id: '1', patternId: a.id, startBar: 0 },
      { id: '2', patternId: b.id, startBar: 2 },
    ];
    expect(blockAt(t, 1)?.pattern.id).toBe(a.id);
    expect(blockAt(t, 2)?.pattern.id).toBe(b.id);
    expect(blockAt(t, 3)?.pattern.id).toBe(a.id);
    expect(blockAt(t, 4)).toBeNull();
  });
});

describe('mixing', () => {
  it('slider curve hits the documented points and round-trips', () => {
    expect(sliderToDb(1)).toBeCloseTo(6);
    expect(sliderToDb(0.5)).toBeCloseTo(-6.04, 1);
    expect(sliderToDb(0)).toBe(-Infinity);
    for (const p of [0.1, 0.3, 0.708, 0.9]) expect(dbToSlider(sliderToDb(p))).toBeCloseTo(p);
    expect(dbToSlider(0)).toBeCloseTo(0.708, 2);
  });
});

describe('factories', () => {
  it('names patterns A, B, … and stops at Z', () => {
    expect(nextPatternName([])).toBe('A');
    const ps = Array.from({ length: 26 }, (_, i) =>
      createPattern({ name: String.fromCharCode(65 + i) }),
    );
    expect(nextPatternName(ps.slice(0, 2))).toBe('C');
    expect(nextPatternName(ps)).toBeNull();
  });
  it('clones tracks with fresh, consistent ids', () => {
    const t = createSynthTrack();
    t.blocks.push({ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 });
    const fx = createFxSlot('filter');
    t.fx.push(fx);
    t.automation.push(createLane({ kind: 'fx', fxId: fx.id, param: 'cutoff' }));
    const c = cloneTrackWithNewIds(t);
    expect(c.id).not.toBe(t.id);
    expect(c.blocks[0]!.patternId).toBe(c.patterns[0]!.id);
    expect(c.automation[0]!.target).toEqual({ kind: 'fx', fxId: c.fx[0]!.id, param: 'cutoff' });
  });
});

describe('schema', () => {
  const song = () => {
    const s = createSong();
    s.tracks.push(createSampleTrack(), createSynthTrack());
    return s;
  };
  it('accepts factory output', () => {
    const s = song();
    expect(validateSong(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('rejects non-song input with a readable message', () => {
    expect(() => validateSong({ hello: 1 })).toThrow(SongFormatError);
    expect(() => validateSong({ hello: 1 })).toThrow(/isn't a Simple Sequencer song/);
    const bad = song() as unknown as { bpm: unknown };
    bad.bpm = 'fast';
    expect(() => validateSong(bad)).toThrow(/bpm should be a number/);
  });
  it('drops blocks pointing at missing patterns', () => {
    const s = song();
    s.tracks[0]!.blocks.push({ id: 'x', patternId: 'missing', startBar: 0 });
    expect(validateSong(s).tracks[0]!.blocks).toHaveLength(0);
  });
  it('refuses future versions', () => {
    expect(() => migrateSong({ ...song(), version: 9 })).toThrow(/newer version/);
  });
});

describe('contentEndBar', () => {
  it('is the bar after the last block on any track (at least 1)', async () => {
    const { contentEndBar } = await import('./timing');
    expect(contentEndBar(createSong())).toBe(1);
    const t = createSampleTrack();
    t.patterns[0]!.lengthBars = 2;
    t.blocks = [{ id: 'a', patternId: t.patterns[0]!.id, startBar: 5 }];
    expect(contentEndBar(createSong({ tracks: [t] }))).toBe(7);
  });
});
