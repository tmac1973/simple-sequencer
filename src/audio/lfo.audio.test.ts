import { describe, it, expect } from 'vitest';
import { createLane, createSong, createSynthTrack } from '@/model/factories';
import type { LfoShape } from '@/model/types';
import { renderSong } from '@/export/render';

/** A held sine note with a volume wobble, rendered offline like an export. */
async function tremolo(shape: LfoShape, rate: number) {
  const t = createSynthTrack({ presetId: 'sub-bass', macros: { space: 0, tone: 1, length: 1 } });
  t.patterns[0]!.lengthBars = 2;
  t.patterns[0]!.notes = [{ start: 0, length: 32, degree: 7, velocity: 1 }];
  t.blocks = [{ id: 'b', patternId: t.patterns[0]!.id, startBar: 0 }];
  t.automation = [
    {
      ...createLane({ kind: 'track', param: 'volume' }),
      mode: 'lfo',
      lfo: { shape, rate, depth: 1, center: 0.5 },
    },
  ];
  const song = createSong({ bpm: 120, lengthBars: 2, tracks: [t] });
  const buf = await renderSong(
    song,
    { playMode: 'song', selectedTrackId: null, selectedPatternId: {} },
    'song',
  );
  // loudness every 10 ms
  const d = buf.getChannelData(0);
  const win = 441;
  const env: number[] = [];
  for (let i = 0; i + win <= 4 * 44100; i += win) {
    let s = 0;
    for (let j = i; j < i + win; j++) s += d[j]! * d[j]!;
    env.push(Math.sqrt(s / win));
  }
  return env;
}

/** How many times the loudness rises past its middle level. */
function pulses(env: number[]) {
  const from = 20; // skip the attack
  const slice = env.slice(from);
  const mid = (Math.max(...slice) + Math.min(...slice)) / 2;
  let n = 0;
  for (let i = 1; i < slice.length; i++) if (slice[i - 1]! < mid && slice[i]! >= mid) n++;
  return { n, depth: Math.max(...slice) / Math.max(1e-6, Math.min(...slice)) };
}

describe('wobble (LFO) in the engine', () => {
  it('a 1/4-note volume wobble pulses twice a second at 120 BPM', async () => {
    const { n, depth } = pulses(await tremolo('sine', 2));
    expect(n).toBeGreaterThanOrEqual(6); // ~3.8 s of a 2 Hz wobble → about 7 pulses
    expect(n).toBeLessThanOrEqual(8);
    expect(depth).toBeGreaterThan(5); // clearly audible
  });

  it('a 1/8-note square wobble chops twice as fast', async () => {
    const { n } = pulses(await tremolo('square', 1));
    expect(n).toBeGreaterThanOrEqual(13);
    expect(n).toBeLessThanOrEqual(16);
  });
});
