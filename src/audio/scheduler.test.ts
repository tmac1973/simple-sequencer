import { computeBeatEvents, getLoopRegion, songBeatFor, type PlayContext } from './scheduler';
import { createPattern, createSampleTrack, createSong, createSynthTrack } from '@/model/factories';
import type { Song, Track } from '@/model/types';

const songCtx: PlayContext = { playMode: 'song', selectedTrackId: null, selectedPatternId: {} };

function withBlocks(t: Track, bars: number[], patternIdx = 0) {
  t.blocks.push(
    ...bars.map((b) => ({
      id: `${t.id}-${b}`,
      patternId: t.patterns[patternIdx]!.id,
      startBar: b,
    })),
  );
  return t;
}

function song(tracks: Track[], extra: Partial<Song> = {}) {
  return createSong({ tracks, lengthBars: 8, ...extra });
}

describe('computeBeatEvents', () => {
  it('four on the floor: one hit per beat', () => {
    const k = createSampleTrack();
    k.patterns[0]!.steps = [0, 4, 8, 12].map((index) => ({ index, velocity: 1 }));
    const s = song([withBlocks(k, [0])]);
    for (let beat = 0; beat < 4; beat++) {
      const ev = computeBeatEvents(s, songCtx, beat);
      expect(ev).toHaveLength(1);
      expect(ev[0]!.offsetBeats).toBe(0);
    }
    expect(computeBeatEvents(s, songCtx, 4)).toHaveLength(0); // empty bar 2
  });

  it('applies swing to odd 16ths only', () => {
    const h = createSampleTrack();
    h.patterns[0]!.steps = [0, 1, 2, 3].map((index) => ({ index, velocity: 1 }));
    const s = song([withBlocks(h, [0])], { swing: 0.5 });
    const offs = computeBeatEvents(s, songCtx, 0).map((e) => e.offsetBeats);
    expect(offs).toEqual([0, 0.25 + 0.0625, 0.5, 0.75 + 0.0625]);
  });

  it('triplet grid emits 6 evenly spaced, unswung steps per beat', () => {
    const h = createSampleTrack();
    h.patterns[0]!.stepsPerBar = 24;
    h.patterns[0]!.steps = Array.from({ length: 24 }, (_, index) => ({ index, velocity: 1 }));
    const s = song([withBlocks(h, [0])], { swing: 0.6 });
    const offs = computeBeatEvents(s, songCtx, 1).map((e) => e.offsetBeats);
    expect(offs).toHaveLength(6);
    offs.forEach((o, i) => expect(o).toBeCloseTo(i / 6));
  });

  it('respects mute and solo', () => {
    const a = withBlocks(createSampleTrack(), [0]);
    const b = withBlocks(createSampleTrack(), [0]);
    a.patterns[0]!.steps = [{ index: 0, velocity: 1 }];
    b.patterns[0]!.steps = [{ index: 0, velocity: 1 }];
    const s = song([a, b]);
    expect(computeBeatEvents(s, songCtx, 0)).toHaveLength(2);
    a.mute = true;
    expect(computeBeatEvents(s, songCtx, 0).map((e) => e.trackId)).toEqual([b.id]);
    a.mute = false;
    a.solo = true;
    expect(computeBeatEvents(s, songCtx, 0).map((e) => e.trackId)).toEqual([a.id]);
  });

  it('repeats a 3-bar pattern inside its block and cuts at the next block', () => {
    const t = createSampleTrack();
    t.patterns[0]!.lengthBars = 3;
    t.patterns[0]!.steps = [{ index: 32, velocity: 1 }]; // bar 3 of the pattern, beat 1
    withBlocks(t, [0, 3]);
    const s = song([t]);
    expect(computeBeatEvents(s, songCtx, 8)).toHaveLength(1); // song bar 2
    expect(computeBeatEvents(s, songCtx, 20)).toHaveLength(1); // song bar 5 = pattern bar 2 of 2nd block
    expect(computeBeatEvents(s, songCtx, 4)).toHaveLength(0);
  });

  it('emits note events with lengths for synth tracks', () => {
    const t = createSynthTrack();
    t.patterns[0]!.notes = [{ start: 2, length: 4, degree: 3, velocity: 0.5 }];
    const s = song([withBlocks(t, [0])]);
    const [ev] = computeBeatEvents(s, songCtx, 0);
    expect(ev).toMatchObject({ kind: 'note', degree: 3, offsetBeats: 0.5, lengthBeats: 1 });
  });
});

describe('pattern mode loop region', () => {
  it('starts at the first placed block of the selected pattern', () => {
    const t = createSampleTrack();
    t.patterns.push(createPattern({ name: 'B', lengthBars: 2 }));
    withBlocks(t, [5, 2], 1);
    const s = song([t]);
    const ctx: PlayContext = {
      playMode: 'pattern',
      selectedTrackId: t.id,
      selectedPatternId: { [t.id]: t.patterns[1]!.id },
    };
    expect(getLoopRegion(s, ctx)).toEqual({ startBar: 2, lengthBars: 2 });
    expect(songBeatFor(s, ctx, 9, 0)).toBe(2 * 4 + 1);
  });

  it('uses bar 0 for an unplaced pattern and always plays the selected pattern', () => {
    const t = createSampleTrack();
    t.patterns[0]!.steps = [{ index: 0, velocity: 1 }];
    const other = withBlocks(createSampleTrack(), [0]);
    other.patterns[0]!.steps = [{ index: 4, velocity: 1 }];
    const s = song([t, other]);
    const ctx: PlayContext = { playMode: 'pattern', selectedTrackId: t.id, selectedPatternId: {} };
    expect(getLoopRegion(s, ctx)).toEqual({ startBar: 0, lengthBars: 1 });
    expect(computeBeatEvents(s, ctx, 0).map((e) => e.trackId)).toEqual([t.id]);
    expect(computeBeatEvents(s, ctx, 1).map((e) => e.trackId)).toEqual([other.id]);
  });

  it('song mode wraps at the song end and honours the start bar', () => {
    const s = song([], { lengthBars: 4 });
    expect(songBeatFor(s, songCtx, 0, 2)).toBe(8);
    expect(songBeatFor(s, songCtx, 8, 2)).toBe(0);
  });
});

describe('notes follow the key', () => {
  it('emits degrees, so a key change re-pitches without wrong notes', async () => {
    const { degreeToMidi } = await import('@/model/scale');
    const t = createSynthTrack();
    t.patterns[0]!.notes = [{ start: 0, length: 4, degree: 2, velocity: 1 }];
    t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
    const s = createSong({ tracks: [t], key: { root: 0, scale: 'minor' } });
    const [ev] = computeBeatEvents(s, songCtx, 0);
    expect(degreeToMidi(ev!.degree!, s.key) % 12).toBe(3); // E♭
    s.key = { root: 9, scale: 'minor' };
    const [ev2] = computeBeatEvents(s, songCtx, 0);
    expect(degreeToMidi(ev2!.degree!, s.key) % 12).toBe(0); // C, minor third of A
  });
});
