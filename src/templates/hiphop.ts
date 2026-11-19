import { createSong } from '@/model/factories';
import type { Song, Track } from '@/model/types';
import {
  addFx,
  chord,
  drumTrack,
  hits,
  melodicSampleTrack,
  note,
  place,
  repeat,
  synthTrack,
  vhits,
} from './helpers';

/** 92 BPM · D minor · boom-bap drums, triplet hats, sub bass, piano chords, vocal chop. */
export function buildHiphop(): Song {
  const tracks: Track[] = [];
  const kick = drumTrack(
    'Kick',
    'lib:808-kick',
    [
      { name: 'A', steps: hits([0, 7, 10], 1) },
      {
        name: 'B',
        steps: vhits([
          [0, 1],
          [3, 0.7],
          [8, 0.9],
          [10, 1],
        ]),
      },
    ],
    tracks,
  );
  place(
    kick,
    [1, 5, 9, 13].flatMap(
      (b) =>
        [
          [b, 'A'],
          [b + 1, 'A'],
          [b + 2, 'A'],
          [b + 3, 'B'],
        ] as [number, string][],
    ),
  );
  addFx(kick, 'compressor', { squash: 0.45, makeup: 0.35 });

  const snare = drumTrack(
    'Snare',
    'lib:808-snare',
    [{ name: 'A', steps: hits([4, 12], 0.9) }],
    tracks,
    { volumeDb: -2 },
  );
  place(snare, repeat(1, 16, 'A'));

  // 16th-note triplet grid (24 steps per bar); pattern B adds rolls
  const eighths = Array.from({ length: 8 }, (_, i) => i * 3);
  const hat = drumTrack(
    'Hats',
    'lib:808-hat',
    [
      { name: 'A', grid: 24, steps: vhits(eighths.map((i) => [i, i % 6 === 0 ? 0.65 : 0.4])) },
      {
        name: 'B',
        grid: 24,
        steps: vhits([
          ...eighths
            .filter((i) => i < 18)
            .map((i) => [i, i % 6 === 0 ? 0.65 : 0.4] as [number, number]),
          [18, 0.6],
          [19, 0.35],
          [20, 0.4],
          [21, 0.5],
          [22, 0.45],
          [23, 0.55],
        ]),
      },
    ],
    tracks,
    { volumeDb: -8, pan: 0.15 },
  );
  place(
    hat,
    [1, 5, 9, 13].flatMap(
      (b) =>
        [
          [b, 'A'],
          [b + 1, 'A'],
          [b + 2, 'A'],
          [b + 3, 'B'],
        ] as [number, string][],
    ),
  );

  const rim = drumTrack(
    'Rim',
    'lib:808-rim',
    [
      {
        name: 'A',
        steps: vhits([
          [6, 0.5],
          [14, 0.6],
        ]),
      },
    ],
    tracks,
    { volumeDb: -8, pan: -0.3 },
  );
  place(rim, repeat(5, 16, 'A'));

  const bass = synthTrack(
    'Sub Bass',
    'sub-bass',
    [
      {
        name: 'A',
        len: 2,
        notes: [
          note(0, 10, 0, 0.95),
          note(10, 4, 0, 0.75),
          note(16, 10, -2, 0.95),
          note(26, 6, -3, 0.8),
        ],
      },
    ],
    tracks,
    { volumeDb: -3, macros: { length: 0.55 } },
  );
  place(bass, repeat(5, 15, 'A', 2));

  // Dm7 → B♭maj7 on a real piano sample (Salamander C4, played in tune)
  const keys = melodicSampleTrack(
    'Keys',
    'lib:piano-c4',
    60,
    [
      {
        name: 'A',
        len: 2,
        notes: [...chord(0, 14, [0, 2, 4, 6], 0.55), ...chord(16, 14, [-2, 0, 2, 4], 0.55)],
      },
    ],
    tracks,
    { volumeDb: -6 },
  );
  place(keys, repeat(1, 15, 'A', 2));
  addFx(keys, 'reverb', { size: 0.55, amount: 0.3 });
  addFx(keys, 'filter', { cutoff: 0.7 });

  const chop = melodicSampleTrack(
    'Vocal Chop',
    'lib:vox-tone',
    74,
    [
      {
        name: 'A',
        len: 2,
        notes: [note(8, 2, 4, 0.7), note(14, 2, 7, 0.6), note(24, 2, 5, 0.7), note(28, 3, 4, 0.6)],
      },
    ],
    tracks,
    { volumeDb: -9, pan: 0.25 },
  );
  place(chop, repeat(9, 15, 'A', 2));
  addFx(chop, 'delay', { time: 0.4, amount: 0.3, feedback: 0.3 });

  return createSong({
    name: 'Hip-hop Beat',
    bpm: 92,
    swing: 0.22,
    key: { root: 2, scale: 'minor' },
    lengthBars: 16,
    tracks,
  });
}
