import { createSong } from '@/model/factories';
import type { Song, Track } from '@/model/types';
import {
  addFx,
  addLane,
  chord,
  drumTrack,
  hits,
  note,
  place,
  repeat,
  synthTrack,
  vhits,
} from './helpers';

/** 84 BPM · C minor · dusty drums, jazzy 7th chords, warm bass, sparse pluck lead. */
export function buildLofi(): Song {
  const tracks: Track[] = [];
  const kick = drumTrack(
    'Kick',
    'lib:dusty-kick',
    [
      { name: 'A', steps: hits([0, 7, 10], 0.95) },
      {
        name: 'B',
        steps: vhits([
          [0, 0.95],
          [3, 0.6],
          [7, 0.9],
          [10, 0.95],
          [14, 0.6],
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

  const snare = drumTrack(
    'Snare',
    'lib:dusty-snare',
    [
      { name: 'A', steps: hits([4, 12], 0.85) },
      {
        name: 'B',
        steps: vhits([
          [4, 0.85],
          [12, 0.85],
          [15, 0.35],
        ]),
      },
    ],
    tracks,
    { volumeDb: -2 },
  );
  place(
    snare,
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
  addFx(snare, 'bitcrush', { crush: 0.3, amount: 0.25 });

  const hat = drumTrack(
    'Hi-hat',
    'lib:dusty-hat',
    [
      {
        name: 'A',
        steps: vhits([0, 2, 4, 6, 8, 10, 12, 14].map((i) => [i, i % 4 === 0 ? 0.7 : 0.4])),
      },
      {
        name: 'B',
        steps: vhits(
          Array.from({ length: 16 }, (_, i) => [i, i % 4 === 0 ? 0.7 : i % 2 ? 0.25 : 0.45]),
        ),
      },
    ],
    tracks,
    { volumeDb: -6, pan: 0.15 },
  );
  place(hat, [...repeat(1, 8, 'A'), ...repeat(9, 16, 'B')]);
  addFx(hat, 'eq', { low: 0.3, high: 0.55 });

  const snap = drumTrack(
    'Snap',
    'lib:dusty-snap',
    [{ name: 'A', steps: vhits([[12, 0.6]]) }],
    tracks,
    { volumeDb: -5, pan: -0.25 },
  );
  place(snap, repeat(9, 16, 'A'));

  // Cm7 → A♭maj7 → Fm7 → Gm7 (scale degrees, so they follow any key change)
  const progression = [
    [0, 2, 4, 6],
    [-2, 0, 2, 4],
    [-4, -2, 0, 2],
    [-3, -1, 1, 3],
  ];
  const chords = synthTrack(
    'Chords',
    'dusty-keys',
    [
      { name: 'A', len: 4, notes: progression.flatMap((d, bar) => chord(bar * 16, 15, d, 0.6)) },
      {
        name: 'B',
        len: 4,
        notes: progression.flatMap((d, bar) => [
          ...chord(bar * 16, 6, d, 0.65),
          ...chord(bar * 16 + 10, 5, d, 0.5),
        ]),
      },
    ],
    tracks,
    { volumeDb: -4, macros: { tone: 0.5, space: 0.25, length: 0.6 } },
  );
  place(chords, [
    [1, 'A'],
    [5, 'A'],
    [9, 'B'],
    [13, 'A'],
  ]);
  const filter = addFx(chords, 'filter', { cutoff: 0.55, resonance: 0.15 });
  addFx(chords, 'reverb', { size: 0.5, amount: 0.3 });
  addLane(chords, { kind: 'fx', fxId: filter.id, param: 'cutoff' }, [
    [1, 0.35],
    [5, 0.35],
    [9, 0.8],
    [17, 0.8],
  ]);

  const roots = [0, -2, -4, -3];
  const bass = synthTrack(
    'Bass',
    'warm-bass',
    [
      {
        name: 'A',
        len: 4,
        notes: roots.flatMap((d, bar) => [
          note(bar * 16, 6, d, 0.9),
          note(bar * 16 + 10, 4, d, 0.7),
        ]),
      },
    ],
    tracks,
    { volumeDb: -3, macros: { tone: 0.45, punch: 0.55 } },
  );
  place(bass, [
    [5, 'A'],
    [9, 'A'],
    [13, 'A'],
  ]);

  const lead = synthTrack(
    'Lead',
    'soft-pluck',
    [
      {
        name: 'A',
        len: 4,
        notes: [
          note(0, 4, 7),
          note(6, 2, 6, 0.6),
          note(8, 6, 4),
          note(20, 4, 2),
          note(26, 4, 4, 0.65),
          note(32, 6, 3),
          note(40, 2, 2, 0.6),
          note(44, 4, 0),
          note(50, 2, -1, 0.6),
          note(52, 8, 0),
        ],
      },
    ],
    tracks,
    { volumeDb: -7, pan: 0.2, macros: { space: 0.45 } },
  );
  place(lead, [
    [9, 'A'],
    [13, 'A'],
  ]);
  addFx(lead, 'delay', { time: 0.6, amount: 0.2, feedback: 0.35 });

  return createSong({
    name: 'Lo-fi Beat',
    bpm: 84,
    swing: 0.28,
    key: { root: 0, scale: 'minor' },
    lengthBars: 16,
    tracks,
  });
}
