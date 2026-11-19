vi.mock('tone', () => ({}));
vi.mock('@/audio/engine', () => ({}));
import { planRender, tailSeconds, MAX_TAIL } from './render';
import { exportFilename } from './exportController';
import { createFxSlot, createPattern, createSampleTrack, createSong } from '@/model/factories';

const ctx = { playMode: 'song' as const, selectedTrackId: null, selectedPatternId: {} };

describe('render planning', () => {
  it('whole song: every beat once, plus a tail of at least 2 s', () => {
    const song = createSong({ bpm: 120, lengthBars: 4 });
    const p = planRender(song, ctx, 'song');
    expect(p.beats).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(p.musicSeconds).toBe(8);
    expect(p.totalSeconds).toBe(10);
  });
  it('pattern loop repeats the loop region and marks each restart', () => {
    const t = createSampleTrack();
    t.patterns.push(createPattern({ name: 'B', lengthBars: 2 }));
    t.blocks = [{ id: 'x', patternId: t.patterns[1]!.id, startBar: 3 }];
    const song = createSong({ tracks: [t] });
    const p = planRender(
      song,
      {
        playMode: 'pattern',
        selectedTrackId: t.id,
        selectedPatternId: { [t.id]: t.patterns[1]!.id },
      },
      { loopRepeats: 2 },
    );
    expect(p.beats.slice(0, 2)).toEqual([12, 13]);
    expect(p.beats).toHaveLength(16);
    expect(p.beats[8]).toBe(12);
    expect([...p.jumps]).toEqual([0, 8]);
  });
  it('tail covers reverb and delay echoes, capped at 10 s', () => {
    const t = createSampleTrack();
    t.fx = [createFxSlot('reverb', { size: 0.75, amount: 0.5 })];
    expect(tailSeconds(createSong({ tracks: [t] }))).toBeCloseTo(4, 0);
    t.fx = [createFxSlot('delay', { time: 1, feedback: 1, amount: 0.5 })];
    expect(tailSeconds(createSong({ tracks: [t], bpm: 60 }))).toBe(MAX_TAIL);
  });
  it('names files after the song and the date', () => {
    expect(exportFilename(createSong({ name: 'My/Beat' }), 'mp3', new Date(2026, 10, 19))).toBe(
      'My-Beat - 2026-11-19.mp3',
    );
  });
});
