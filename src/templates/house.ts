import { createSong } from '@/model/factories';
import type { Song, Track } from '@/model/types';
import { addFx, chord, drumTrack, hits, note, place, repeat, synthTrack, vhits } from './helpers';

/** 124 BPM · A minor · four-on-the-floor, offbeat hats, stab chords, Reese bass. */
export function buildHouse(): Song {
  const tracks: Track[] = [];
  const kick = drumTrack(
    'Kick',
    'lib:club-kick',
    [{ name: 'A', steps: hits([0, 4, 8, 12], 1) }],
    tracks,
  );
  place(kick, [...repeat(1, 12, 'A'), ...repeat(15, 16, 'A')]);

  const clap = drumTrack(
    'Clap',
    'lib:club-clap',
    [{ name: 'A', steps: hits([4, 12], 0.85) }],
    tracks,
    { volumeDb: -3 },
  );
  place(clap, [...repeat(5, 12, 'A'), ...repeat(15, 16, 'A')]);
  addFx(clap, 'reverb', { size: 0.3, amount: 0.2 });

  const open = drumTrack(
    'Open Hat',
    'lib:club-hat-open',
    [{ name: 'A', steps: hits([2, 6, 10, 14], 0.6) }],
    tracks,
    { volumeDb: -8, pan: 0.2 },
  );
  place(open, repeat(1, 16, 'A'));

  const hat = drumTrack(
    'Closed Hat',
    'lib:club-hat',
    [
      { name: 'A', steps: vhits(Array.from({ length: 16 }, (_, i) => [i, i % 2 ? 0.3 : 0.5])) },
      {
        name: 'B',
        steps: vhits(
          Array.from({ length: 16 }, (_, i) => [i, i % 4 === 3 ? 0.75 : i % 2 ? 0.28 : 0.5]),
        ),
      },
    ],
    tracks,
    { volumeDb: -10, pan: -0.2 },
  );
  place(hat, [...repeat(5, 8, 'A'), ...repeat(9, 12, 'B'), ...repeat(13, 16, 'A')]);

  const perc = drumTrack(
    'Shaker',
    'lib:club-perc-shaker',
    [{ name: 'A', steps: hits([3, 7, 11, 13, 15], 0.5) }],
    tracks,
    { volumeDb: -9, pan: 0.35 },
  );
  place(perc, repeat(9, 16, 'A'));

  // Am7 → Fmaj7 stabs on the offbeats
  const am7 = [0, 2, 4, 6];
  const fmaj7 = [-2, 0, 2, 4];
  const stabs = (d: number[], bar: number) => [
    ...chord(bar * 16 + 3, 2, d, 0.65),
    ...chord(bar * 16 + 6, 2, d, 0.55),
    ...chord(bar * 16 + 10, 3, d, 0.6),
  ];
  const stab = synthTrack(
    'Stabs',
    'electric-piano',
    [{ name: 'A', len: 2, notes: [...stabs(am7, 0), ...stabs(fmaj7, 1)] }],
    tracks,
    { volumeDb: -5, macros: { tone: 0.65, punch: 0.75, length: 0.35 } },
  );
  place(stab, [...repeat(5, 11, 'A', 2), [13, 'A'], [15, 'A']]);
  addFx(stab, 'delay', { time: 0.4, amount: 0.25, feedback: 0.4 });
  addFx(stab, 'reverb', { size: 0.6, amount: 0.25 });

  const bass = synthTrack(
    'Bass',
    'reese-bass',
    [
      {
        name: 'A',
        len: 2,
        notes: [2, 6, 10, 14].flatMap((s) => [note(s, 2, 0, 0.85), note(16 + s, 2, -2, 0.85)]),
      },
    ],
    tracks,
    { volumeDb: -5, macros: { tone: 0.4, punch: 0.6, length: 0.3 } },
  );
  place(bass, [...repeat(5, 11, 'A', 2), [15, 'A']]);

  return createSong({
    name: 'House Groove',
    bpm: 124,
    swing: 0.1,
    key: { root: 9, scale: 'minor' },
    lengthBars: 16,
    tracks,
  });
}
