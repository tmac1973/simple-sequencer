import { computeBeatEvents, playStepFor, type PlayContext } from './scheduler';
import { createSampleTrack, createSong } from '@/model/factories';
import { shiftLoop } from '@/store/uiStore';
import { planRender } from '@/export/render';
import { BEATS_PER_BAR } from '@/model/timing';

const songCtx: PlayContext = { playMode: 'song', selectedTrackId: null, selectedPatternId: {} };

function hatSong(chance?: number, humanize?: number) {
  const t = createSampleTrack();
  t.patterns[0]!.steps = Array.from({ length: 16 }, (_, index) => ({
    index,
    velocity: 0.8,
    ...(chance !== undefined ? { chance } : {}),
  }));
  t.blocks = [0, 1, 2, 3].map((b) => ({ id: `b${b}`, patternId: t.patterns[0]!.id, startBar: b }));
  if (humanize) t.humanize = humanize;
  return createSong({ tracks: [t], lengthBars: 4 });
}

describe('song loop', () => {
  it('loops the chosen bars, starting at ▼ when it is inside the loop', () => {
    const s = createSong({ lengthBars: 16 });
    const ctx = { ...songCtx, songLoop: { startBar: 4, lengthBars: 2 } };
    const beats = (from: number) =>
      Array.from({ length: 10 }, (_, c) => playStepFor(s, ctx, c, from).beat);
    expect(beats(0)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 16, 17]);
    expect(beats(5)).toEqual([20, 21, 22, 23, 16, 17, 18, 19, 20, 21]);
    expect(playStepFor(s, ctx, 7, 0).pass).toBe(0);
    expect(playStepFor(s, ctx, 8, 0).pass).toBe(1);
    // no loop: whole song from ▼
    expect(playStepFor(s, songCtx, 3, 15).beat).toBe(63);
    expect(playStepFor(s, songCtx, 4, 15)).toEqual({ beat: 0, pass: 1 });
  });

  it('a loop past the end of the song is ignored, and one running over is cut', () => {
    const s = createSong({ lengthBars: 8 });
    expect(
      playStepFor(s, { ...songCtx, songLoop: { startBar: 9, lengthBars: 2 } }, 40, 0).beat,
    ).toBe(8);
    const over = { ...songCtx, songLoop: { startBar: 6, lengthBars: 4 } };
    expect(playStepFor(s, over, 8, 0)).toEqual({ beat: 24, pass: 1 });
  });

  it('moves with inserted and deleted bars', () => {
    const l = { startBar: 4, lengthBars: 4 };
    expect(shiftLoop(l, 0, 2)).toEqual({ startBar: 6, lengthBars: 4 });
    expect(shiftLoop(l, 6, 2)).toEqual({ startBar: 4, lengthBars: 6 });
    expect(shiftLoop(l, 8, 4)).toEqual(l);
    expect(shiftLoop(l, 0, -2)).toEqual({ startBar: 2, lengthBars: 4 });
    expect(shiftLoop(l, 5, -2)).toEqual({ startBar: 4, lengthBars: 2 });
    expect(shiftLoop(l, 2, -4)).toEqual({ startBar: 2, lengthBars: 2 });
    expect(shiftLoop(l, 4, -4)).toBeNull();
  });

  it('export can render just the song loop', () => {
    const s = createSong({ lengthBars: 16 });
    const p = planRender(s, songCtx, { loopRepeats: 2, songLoop: { startBar: 4, lengthBars: 2 } });
    expect(p.beats.slice(0, 9)).toEqual([16, 17, 18, 19, 20, 21, 22, 23, 16]);
    expect(p.passes[7]).toBe(0);
    expect(p.passes[8]).toBe(1);
    expect(p.ctx.playMode).toBe('song');
  });
});

describe('chance and humanize in playback', () => {
  const hits = (s: ReturnType<typeof hatSong>, pass: number) =>
    Array.from({ length: 16 }, (_, b) => computeBeatEvents(s, songCtx, b, pass)).flat();

  it('100% chance and no humanize play exactly as written', () => {
    const ev = hits(hatSong(), 0);
    expect(ev).toHaveLength(64);
    expect(ev.every((e) => e.velocity === 0.8)).toBe(true);
  });

  it('chance drops some hits, the same ones every time for a pass, different per pass', () => {
    const s = hatSong(0.5);
    const a = hits(s, 0).length;
    expect(a).toBeGreaterThan(16);
    expect(a).toBeLessThan(48);
    expect(hits(s, 0)).toEqual(hits(s, 0));
    expect(hits(s, 1)).not.toEqual(hits(s, 0));
    // export's first time through matches live playback's first pass
    const plan = planRender(s, songCtx, 'song');
    expect(plan.passes.every((p) => p === 0)).toBe(true);
  });

  it('humanize nudges timing and loudness a little', () => {
    const s = hatSong(undefined, 1);
    const ev = hits(s, 0);
    expect(ev).toHaveLength(64);
    const offsets = ev.map((e) => e.offsetBeats % 0.25);
    expect(new Set(ev.map((e) => e.velocity)).size).toBeGreaterThan(10);
    // ±12 ms at 120 bpm is under 0.025 beats
    for (const e of ev)
      expect(
        Math.min(...[0, 0.25, 0.5, 0.75, 1].map((g) => Math.abs(e.offsetBeats - g))),
      ).toBeLessThan(0.025);
    expect(offsets.some((o) => o > 0.001 && o < 0.249)).toBe(true);
    expect(BEATS_PER_BAR).toBe(4);
  });
});
