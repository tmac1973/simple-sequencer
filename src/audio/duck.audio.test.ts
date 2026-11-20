import { describe, it, expect } from 'vitest';
import { createSong, createSynthTrack } from '@/model/factories';
import { renderSong } from '@/export/render';

/** A held pad that ducks to a silent "kick" on every beat, rendered offline like an export. */
async function pumpedPad(on: boolean) {
  const pad = createSynthTrack({ presetId: 'sub-bass', macros: { space: 0, tone: 1, length: 1 } });
  pad.patterns[0]!.lengthBars = 2;
  pad.patterns[0]!.notes = [{ start: 0, length: 32, degree: 7, velocity: 1 }];
  pad.blocks = [{ id: 'p', patternId: pad.patterns[0]!.id, startBar: 0 }];
  // the trigger: plays every beat, turned all the way down so only the ducking is heard
  const kick = createSynthTrack({ presetId: 'sub-bass' });
  kick.volumeDb = -60;
  kick.patterns[0]!.notes = [0, 4, 8, 12].map((start) => ({
    start,
    length: 1,
    degree: 0,
    velocity: 1,
  }));
  kick.blocks = [0, 1].map((b) => ({ id: `k${b}`, patternId: kick.patterns[0]!.id, startBar: b }));
  pad.duck = { sourceId: kick.id, on, amount: 0.9, release: 2 };
  const song = createSong({ bpm: 120, lengthBars: 2, tracks: [pad, kick] });
  const buf = await renderSong(
    song,
    { playMode: 'song', selectedTrackId: null, selectedPatternId: {} },
    'song',
  );
  const d = buf.getChannelData(0);
  /** RMS loudness over 10 ms starting at `sec` */
  return (sec: number) => {
    const a = Math.round(sec * 44100);
    let s = 0;
    for (let j = a; j < a + 441; j++) s += d[j]! * d[j]!;
    return Math.sqrt(s / 441);
  };
}

describe('sidechain pump (ducking)', () => {
  it('dips the pad right after each kick and swells back before the next', async () => {
    const level = await pumpedPad(true);
    for (const beat of [1, 2, 3, 5, 6]) {
      const t = beat * 0.5;
      const dipped = level(t + 0.01);
      const back = level(t + 0.42);
      expect(back / Math.max(1e-6, dipped)).toBeGreaterThan(4);
    }
  });

  it('switched off, the pad stays steady', async () => {
    const level = await pumpedPad(false);
    for (const beat of [1, 2, 3, 5, 6]) {
      const t = beat * 0.5;
      expect(level(t + 0.42) / level(t + 0.01)).toBeLessThan(1.3);
    }
  });
});
