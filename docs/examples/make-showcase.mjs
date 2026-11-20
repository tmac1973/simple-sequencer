#!/usr/bin/env node
/**
 * "Format Showcase": a 16-bar lo-fi tune in D dorian that uses every option in the song
 * format at least once (see docs/SONG_FORMAT.md). Writes JSON to stdout:
 *
 *   node docs/examples/make-showcase.mjs > docs/examples/showcase-song.json
 *
 * Arrangement (bars as the app shows them):
 *   1–4    intro: vinyl hiss, pad fading in, Rhodes chords, a reversed crash into bar 5
 *   5–8    the beat comes in: kick, snare, hats; bass and chords pump to the kick
 *   9–12   guitar melody on top, triplet shaker
 *   13–14  break: drums drop out, pad returns, another reversed crash
 *   15–16  last run of the beat, guitar plays the ending phrase
 * There's also a muted vibraphone track: unmute it to hear an extra arpeggio in the break.
 */

// ---------- helpers ----------

const BAR = 16; // steps per bar in a 16ths pattern

const edit = (o = {}) => ({
  start: 0,
  end: 1,
  reverse: false,
  loop: false,
  loopStart: 0,
  tuneSemitones: 0,
  fadeOut: 0,
  normalize: false,
  ...o,
});

function track(id, name, color, kind, extra) {
  return {
    id,
    name,
    color,
    kind,
    volumeDb: 0,
    pan: 0,
    mute: false,
    solo: false,
    patterns: [],
    blocks: [],
    fx: [],
    automation: [],
    ...extra,
  };
}

const sampleTrack = (id, name, color, sample, extra = {}) =>
  track(id, name, color, 'sample', {
    ...extra,
    sample: { melodic: false, rootMidi: 60, tone: 1, ...sample, edit: edit(sample.edit) },
  });

const synthTrack = (id, name, color, presetId, macros, advanced = {}, extra = {}) =>
  track(id, name, color, 'synth', {
    ...extra,
    synth: {
      presetId,
      macros: { tone: 0.55, punch: 0.5, space: 0.2, length: 0.5, ...macros },
      advanced,
    },
  });

function pattern(t, name, o) {
  const p = {
    id: `${t.id}-${name}`,
    name,
    lengthBars: o.lengthBars ?? 1,
    stepsPerBar: o.stepsPerBar ?? 16,
    steps: o.steps ?? [],
    notes: o.notes ?? [],
  };
  t.patterns.push(p);
  return p;
}

/** Put a pattern on the timeline at each bar (0-based in the file). */
function place(t, p, bars) {
  for (const startBar of bars)
    t.blocks.push({ id: `${p.id}-at${startBar}`, patternId: p.id, startBar });
}

const range = (from, to, step = 1) => {
  const out = [];
  for (let i = from; i < to; i += step) out.push(i);
  return out;
};

/** [index, velocity, chance?] → Step */
const steps = (list) =>
  list.map(([index, velocity, chance]) =>
    chance === undefined ? { index, velocity } : { index, velocity, chance },
  );

/** [start, length, degree, velocity?, chance?] → Note */
const notes = (list, vel = 0.8) =>
  list.map(([start, length, degree, velocity = vel, chance]) =>
    chance === undefined
      ? { start, length, degree, velocity }
      : { start, length, degree, velocity, chance },
  );

/** One chord: the same start and length for several degrees. */
const chord = (start, length, degrees, velocity, chance) =>
  degrees.map((degree) => [start, length, degree, velocity, chance]);

// D dorian, one chord per bar: Dm7 – G – C – Am (scale degrees, 0 = D)
const PROGRESSION = [
  [0, 2, 4, 6],
  [3, 5, 7, 9],
  [-1, 1, 3, 6],
  [-3, -1, 1, 4],
];
const ROOTS = [0, 3, 6, 4];

// ---------- drums ----------

const kick = sampleTrack(
  'kick',
  'Kick',
  '#ff6b6b',
  {
    sampleId: 'lib:dusty-kick',
    edit: { normalize: true, end: 0.8 },
  },
  { volumeDb: -3 },
);
const kickA = pattern(kick, 'A', {
  steps: steps([
    [0, 1],
    [7, 0.7, 0.6],
    [10, 0.95],
  ]),
});
const kickB = pattern(kick, 'B', {
  steps: steps([
    [0, 1],
    [7, 0.7],
    [10, 0.95],
    [13, 0.6],
    [15, 0.8],
  ]),
});
place(kick, kickA, [4, 5, 6, 8, 9, 10, 14]);
place(kick, kickB, [7, 11, 15]);

const snare = sampleTrack(
  'snare',
  'Snare',
  '#ffb84d',
  { sampleId: 'lib:dusty-snare', tone: 0.8, edit: { tuneSemitones: -2, fadeOut: 0.3 } },
  { volumeDb: -2, humanize: 0.3 },
);
snare.fx.push({
  id: 'snare-comp',
  type: 'compressor',
  enabled: true,
  params: { squash: 0.6, makeup: 0.35, attack: 0.3, release: 0.35 },
});
const snareA = pattern(snare, 'A', {
  steps: steps([
    [4, 0.95],
    [12, 0.95],
    [15, 0.3, 0.4],
  ]),
});
const snareB = pattern(snare, 'B', {
  steps: steps([
    [4, 0.95],
    [12, 0.95],
    [13, 0.4],
    [14, 0.6],
    [15, 0.8],
  ]),
});
place(snare, snareA, [4, 5, 6, 8, 9, 10, 14]);
place(snare, snareB, [7, 11, 15]);

const hats = sampleTrack(
  'hats',
  'Hi-hat',
  '#ffe066',
  { sampleId: 'lib:dusty-hat', edit: { end: 0.6 } },
  { volumeDb: -6, humanize: 0.5 },
);
const hatsA = pattern(hats, 'A', {
  steps: steps(
    range(0, 16).map((i) =>
      i === 7 ? [i, 0.4, 0.6] : i === 14 ? [i, 0.5, 0.5] : [i, i % 2 ? 0.45 : 0.8],
    ),
  ),
});
place(hats, hatsA, [...range(4, 12), 14, 15]);
// the hats drift left and right over two bars (a wobble on the pan knob)
hats.automation.push({
  id: 'hats-pan',
  target: { kind: 'track', param: 'pan' },
  visible: true,
  points: [],
  mode: 'lfo',
  lfo: { shape: 'sine', rate: 5, depth: 0.5, center: 0.5 },
});
// …and drift twice as fast from bar 9 (speed 0.71 → 2 bars, 0.57 → 1 bar)
hats.automation.push({
  id: 'hats-pan-speed',
  target: { kind: 'lfo', laneId: 'hats-pan', param: 'speed' },
  visible: false,
  points: [
    { bar: 0, value: 0.71 },
    { bar: 8, value: 0.71 },
    { bar: 8, value: 0.57 },
  ],
});

// triplet shaker: 24 steps per bar, 2-bar pattern
const shaker = sampleTrack(
  'shaker',
  'Shaker',
  '#5ee6a8',
  { sampleId: 'lib:club-perc-shaker' },
  { volumeDb: -10, pan: 0.35, humanize: 0.6 },
);
const shakerA = pattern(shaker, 'A', {
  lengthBars: 2,
  stepsPerBar: 24,
  steps: steps(range(0, 48, 2).map((i) => (i % 6 === 0 ? [i, 0.7] : [i, 0.4, 0.85]))),
});
place(shaker, shakerA, [8, 10]);

// ---------- bass ----------

const bass = synthTrack(
  'bass',
  'Bass',
  '#4dc9ff',
  'warm-bass',
  { tone: 0.4, punch: 0.65, space: 0, length: 0.35 },
  { glide: 0.04, filterQ: 3 },
  { volumeDb: -4, duck: { sourceId: 'kick', on: true, amount: 0.5, release: 1 } },
);
bass.fx.push({
  id: 'bass-eq',
  type: 'eq',
  enabled: true,
  params: { low: 0.65, mid: 0.45, high: 0.4, lowFreq: 0.35, highFreq: 0.5 },
});
const bassA = pattern(bass, 'A', {
  lengthBars: 4,
  notes: notes(
    ROOTS.flatMap((r, bar) => {
      const b = bar * BAR;
      return [
        [b, 3, r, 0.9],
        [b + 6, 2, r, 0.75],
        [b + 10, 2, r + 7, 0.7],
        [b + 14, 1, r + 2, 0.55, 0.7],
      ];
    }),
  ),
});
const bassB = pattern(bass, 'B', {
  lengthBars: 2,
  notes: notes([
    [0, 3, 6, 0.9],
    [6, 2, 6, 0.75],
    [10, 4, 5, 0.7],
    [16, 6, 4, 0.9],
    [24, 8, 0, 0.85],
  ]),
});
place(bass, bassA, [4, 8]);
place(bass, bassB, [14]);

// ---------- chords, pad, texture ----------

const keys = synthTrack(
  'keys',
  'Rhodes',
  '#a78bfa',
  'electric-piano',
  { tone: 0.5, punch: 0.4, space: 0.3, length: 0.6 },
  {},
  { volumeDb: -4, pan: -0.15, duck: { sourceId: 'kick', on: true, amount: 0.35, release: 2 } },
);
keys.fx.push(
  {
    id: 'keys-chorus',
    type: 'chorus',
    enabled: true,
    params: { width: 0.6, amount: 0.4, rate: 0.25 },
  },
  {
    id: 'keys-filter',
    type: 'filter',
    enabled: true,
    params: { cutoff: 0.7, resonance: 0.25, type: 0 },
  },
  {
    id: 'keys-crush',
    type: 'bitcrush',
    enabled: false,
    params: { crush: 0.6, amount: 0.5, down: 0.2 },
  },
);
const keysA = pattern(keys, 'A', {
  lengthBars: 4,
  notes: notes(
    PROGRESSION.flatMap((c, bar) => [
      ...chord(bar * BAR, 6, c, 0.75),
      ...chord(bar * BAR + 7, 3, c, 0.5, 0.8),
      ...chord(bar * BAR + 10, 6, c, 0.65),
    ]),
  ),
});
place(keys, keysA, [0, 4, 8, 12]);
// Tone opens up over the intro, then jumps back down at the break (two points on bar 12)
keys.automation.push({
  id: 'keys-tone',
  target: { kind: 'synthMacro', macro: 'tone' },
  visible: true,
  points: [
    { bar: 0, value: 0.3 },
    { bar: 4, value: 0.6 },
    { bar: 12, value: 0.6 },
    { bar: 12, value: 0.35 },
    { bar: 14, value: 0.6 },
  ],
});
// the filter cutoff wobbles slowly; a second lane fades that wobble in over the song
keys.automation.push(
  {
    id: 'keys-cutoff',
    target: { kind: 'fx', fxId: 'keys-filter', param: 'cutoff' },
    visible: true,
    points: [{ bar: 0, value: 0.7 }],
    mode: 'lfo',
    lfo: { shape: 'triangle', rate: 6, depth: 0.3, center: 0.7 },
  },
  {
    id: 'keys-cutoff-amount',
    target: { kind: 'lfo', laneId: 'keys-cutoff', param: 'amount' },
    visible: false,
    points: [
      { bar: 0, value: 0 },
      { bar: 8, value: 1 },
    ],
  },
);

const pad = synthTrack(
  'pad',
  'Pad',
  '#ff7ac6',
  'soft-pad',
  { tone: 0.45, punch: 0.2, space: 0.5, length: 0.8 },
  { attack: 1.2, release: 2.5 },
  { volumeDb: -9, duck: { sourceId: 'kick', on: true, amount: 0.7, release: 2 } },
);
pad.fx.push({
  id: 'pad-reverb',
  type: 'reverb',
  enabled: true,
  params: { size: 0.75, amount: 0.45, predelay: 0.2 },
});
const padA = pattern(pad, 'A', {
  lengthBars: 4,
  notes: notes(
    PROGRESSION.flatMap((c, bar) =>
      chord(
        bar * BAR,
        16,
        c.map((d) => d + 7),
        0.6,
      ),
    ),
  ),
});
place(pad, padA, [0, 12]);
pad.automation.push(
  {
    // fade in over the intro
    id: 'pad-volume',
    target: { kind: 'track', param: 'volume' },
    visible: true,
    points: [
      // 0.42 on the fader = -9 dB, the track's own volume
      { bar: 0, value: 0.1 },
      { bar: 3, value: 0.42 },
    ],
  },
  {
    // more space in the break
    id: 'pad-space',
    target: { kind: 'synthMacro', macro: 'space' },
    visible: false,
    points: [
      { bar: 0, value: 0.5 },
      { bar: 12, value: 0.5 },
      { bar: 13, value: 0.85 },
    ],
  },
);

// vinyl hiss as a looping melodic sample: rootMidi 50 = D3, so degree 0 plays it at its own pitch
const vinyl = sampleTrack(
  'vinyl',
  'Vinyl',
  '#7ee0ff',
  {
    sampleId: 'lib:fx-hiss',
    melodic: true,
    rootMidi: 50,
    tone: 0.55,
    edit: { loop: true, loopStart: 0.3, normalize: true },
  },
  { volumeDb: -20, pan: -0.1 },
);
vinyl.fx.push({
  id: 'vinyl-crush',
  type: 'bitcrush',
  enabled: true,
  params: { crush: 0.35, amount: 0.3, down: 0.15 },
});
const vinylA = pattern(vinyl, 'A', { lengthBars: 4, notes: notes([[0, 64, 0, 0.7]]) });
place(vinyl, vinylA, [0, 4, 8, 12]);

// reversed crash that swells into bar 5 and bar 15
const riser = sampleTrack(
  'riser',
  'Reverse Crash',
  '#c3f06b',
  { sampleId: 'lib:dusty-crash', edit: { reverse: true } },
  { volumeDb: -5 },
);
riser.fx.push({
  id: 'riser-delay',
  type: 'delay',
  enabled: true,
  params: { time: 0.6, amount: 0.25, feedback: 0.35, pingpong: 1 },
});
place(riser, pattern(riser, 'A', { steps: steps([[6, 0.9]]) }), [3, 13]);

// ---------- melody ----------

// a mellow electric guitar (sample root note A3 = MIDI 57) played as a melodic sample
const guitar = sampleTrack(
  'guitar',
  'Guitar',
  '#ff9e6b',
  { sampleId: 'lib:gtr-mellow', melodic: true, rootMidi: 57, tone: 0.8, edit: { fadeOut: 0.2 } },
  { volumeDb: -3, pan: 0.15, humanize: 0.2 },
);
guitar.fx.push(
  {
    id: 'guitar-drive',
    type: 'distortion',
    enabled: true,
    params: { drive: 0.25, amount: 0.3, oversample: 0.5 },
  },
  {
    id: 'guitar-delay',
    type: 'delay',
    enabled: true,
    params: { time: 0.4, amount: 0.3, feedback: 0.4, pingpong: 0 },
  },
);
const guitarA = pattern(guitar, 'A', {
  lengthBars: 2,
  notes: notes([
    [0, 3, 4],
    [3, 1, 6, 0.6],
    [4, 2, 7],
    [6, 2, 6, 0.7],
    [8, 4, 4],
    [14, 2, 2, 0.6, 0.6],
    [16, 2, 3],
    [18, 2, 4, 0.7],
    [20, 4, 5],
    [26, 2, 4, 0.7],
    [28, 4, 3],
  ]),
});
const guitarB = pattern(guitar, 'B', {
  lengthBars: 2,
  notes: notes([
    [0, 2, 6],
    [2, 2, 4, 0.7],
    [4, 4, 2],
    [10, 2, 1, 0.6],
    [12, 4, 0],
    [16, 4, 4],
    [22, 2, 2, 0.7],
    [24, 8, 0, 0.85],
  ]),
});
place(guitar, guitarA, [8, 10]);
place(guitar, guitarB, [14]);
// the guitar gets brighter as the melody climbs
guitar.automation.push({
  id: 'guitar-tone',
  target: { kind: 'sampleTone' },
  visible: true,
  points: [
    { bar: 8, value: 0.55 },
    { bar: 12, value: 0.9 },
  ],
});

// a muted extra part: unmute it to hear a vibraphone arpeggio in the break
const vibes = sampleTrack(
  'vibes',
  'Vibes (muted)',
  '#b9a6ff',
  { sampleId: 'lib:vibes', melodic: true, rootMidi: 60 },
  { mute: true, volumeDb: -6, pan: 0.3 },
);
place(
  vibes,
  pattern(vibes, 'A', {
    lengthBars: 2,
    stepsPerBar: 24,
    notes: notes(
      [7, 9, 11, 13, 11, 9, 8, 10, 12, 14, 12, 10].map((degree, i) => [i * 4, 4, degree, 0.6]),
    ),
  }),
  [12],
);

// ---------- song ----------

const created = Date.UTC(2026, 10, 20);
const song = {
  format: 'simple-sequencer-song',
  version: 1,
  id: 'format-showcase',
  name: 'Format Showcase',
  bpm: 92,
  swing: 0.15,
  key: { root: 2, scale: 'dorian' }, // D dorian
  lengthBars: 16,
  tracks: [kick, snare, hats, shaker, bass, keys, pad, vinyl, riser, guitar, vibes],
  createdAt: created,
  updatedAt: created,
};

process.stdout.write(JSON.stringify(song, null, 2) + '\n');
