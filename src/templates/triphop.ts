import { createSong } from '@/model/factories';
import type { Song, Track } from '@/model/types';
import {
  addFx,
  addLane,
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

/**
 * 82 BPM · D minor · slow, heavy, dusty drums with ghost notes, vinyl hiss, a dark pad that
 * slowly opens up, sub bass, vibraphone melody drenched in echo, and scratches at the turnarounds.
 */
export function buildTriphop(): Song {
  const tracks: Track[] = [];

  // Intro (bars 1–4): pad, vinyl and hats. Drums and bass drop in at bar 5, vibes at bar 9.
  const vinyl = drumTrack(
    'Vinyl',
    'lib:fx-hiss',
    [{ name: 'A', len: 2, steps: hits([0], 0.6) }],
    tracks,
    {
      volumeDb: -16,
    },
  );
  place(vinyl, repeat(1, 15, 'A', 2));
  addFx(vinyl, 'filter', { cutoff: 0.62, resonance: 0.1 });

  const kick = drumTrack(
    'Kick',
    'lib:dusty-kick-heavy',
    [
      {
        name: 'A',
        steps: vhits([
          [0, 1],
          [7, 0.55],
          [10, 0.95],
        ]),
      },
      {
        name: 'B',
        steps: vhits([
          [0, 1],
          [3, 0.5],
          [10, 0.95],
          [14, 0.6],
        ]),
      },
    ],
    tracks,
  );
  place(
    kick,
    [5, 9, 13].flatMap(
      (b) =>
        [
          [b, 'A'],
          [b + 1, 'A'],
          [b + 2, 'A'],
          [b + 3, 'B'],
        ] as [number, string][],
    ),
  );
  addFx(kick, 'compressor', { squash: 0.5, makeup: 0.35 });

  const snare = drumTrack(
    'Snare',
    'lib:dusty-snare',
    [
      {
        name: 'A',
        steps: vhits([
          [4, 0.9],
          [9, 0.22],
          [12, 0.9],
        ]),
      },
      {
        name: 'B',
        steps: vhits([
          [4, 0.9],
          [9, 0.22],
          [12, 0.9],
          [14, 0.3],
          [15, 0.4],
        ]),
      },
    ],
    tracks,
    { volumeDb: -2 },
  );
  place(
    snare,
    [5, 9, 13].flatMap(
      (b) =>
        [
          [b, 'A'],
          [b + 1, 'A'],
          [b + 2, 'A'],
          [b + 3, 'B'],
        ] as [number, string][],
    ),
  );
  addFx(snare, 'bitcrush', { crush: 0.35, amount: 0.3 });
  addFx(snare, 'reverb', { size: 0.7, amount: 0.35 });

  const hat = drumTrack(
    'Hi-hat',
    'lib:analog-hat',
    [
      {
        name: 'A',
        steps: vhits([
          [0, 0.55],
          [2, 0.3],
          [4, 0.45],
          [6, 0.3],
          [8, 0.55],
          [10, 0.3],
          [11, 0.2],
          [12, 0.45],
          [14, 0.35],
        ]),
      },
    ],
    tracks,
    { volumeDb: -10, pan: 0.2 },
  );
  place(hat, repeat(1, 16, 'A'));
  addFx(hat, 'filter', { cutoff: 0.78, resonance: 0.15 });

  const scratch = drumTrack(
    'Scratch',
    'lib:fx-scratch',
    [
      {
        name: 'A',
        steps: vhits([
          [12, 0.75],
          [14, 0.6],
        ]),
      },
    ],
    tracks,
    { volumeDb: -7, pan: -0.25 },
  );
  place(scratch, [
    [8, 'A'],
    [16, 'A'],
  ]);

  // Dm7 → B♭maj7 → Gm7 → Am7, held for a bar each
  const progression = [
    [0, 2, 4, 6],
    [-2, 0, 2, 4],
    [-4, -2, 0, 2],
    [-3, -1, 1, 3],
  ];
  const pad = synthTrack(
    'Pad',
    'soft-pad',
    [{ name: 'A', len: 4, notes: progression.flatMap((d, bar) => chord(bar * 16, 16, d, 0.55)) }],
    tracks,
    { volumeDb: -3, macros: { tone: 0.4, punch: 0.2, space: 0.5, length: 0.7 } },
  );
  place(pad, repeat(1, 13, 'A', 4));
  const padFilter = addFx(pad, 'filter', { cutoff: 0.35, resonance: 0.25 });
  addFx(pad, 'chorus', { width: 0.6, amount: 0.4 });
  // the pad slowly opens up through the intro, then breathes back at the end
  addLane(pad, { kind: 'fx', fxId: padFilter.id, param: 'cutoff' }, [
    [1, 0.35],
    [5, 0.55],
    [13, 0.6],
    [17, 0.35],
  ]);

  const bass = synthTrack(
    'Sub Bass',
    'sub-bass',
    [
      {
        name: 'A',
        len: 4,
        notes: [
          note(0, 12, 0, 0.95),
          note(14, 2, 0, 0.6),
          note(16, 14, -2, 0.95),
          note(32, 12, -4, 0.95),
          note(46, 2, -4, 0.6),
          note(48, 12, -3, 0.95),
          note(60, 4, -1, 0.7),
        ],
      },
    ],
    tracks,
    { volumeDb: -3, macros: { tone: 0.35, length: 0.6 } },
  );
  place(bass, repeat(5, 13, 'A', 4));

  const vibes = melodicSampleTrack(
    'Vibes',
    'lib:vibes',
    60,
    [
      {
        name: 'A',
        len: 4,
        notes: [
          note(0, 6, 7, 0.7),
          note(8, 4, 9, 0.55),
          note(12, 4, 8, 0.5),
          note(16, 10, 6, 0.65),
          note(32, 4, 4, 0.6),
          note(38, 2, 6, 0.5),
          note(40, 8, 7, 0.65),
          note(52, 4, 5, 0.55),
          note(56, 8, 4, 0.6),
        ],
      },
    ],
    tracks,
    { volumeDb: -9, pan: 0.15 },
  );
  place(vibes, [
    [9, 'A'],
    [13, 'A'],
  ]);
  addFx(vibes, 'delay', { time: 0.6, amount: 0.35, feedback: 0.5, pingpong: 1 });
  addFx(vibes, 'reverb', { size: 0.75, amount: 0.4 });

  return createSong({
    name: 'Trip-hop',
    bpm: 82,
    swing: 0.18,
    key: { root: 2, scale: 'minor' },
    lengthBars: 16,
    tracks,
  });
}
