#!/usr/bin/env node
/**
 * Builds a Simple Sequencer song from code and prints it as JSON.
 *
 *   node docs/examples/make-song.mjs > my-song.json
 *
 * Then open the app, click 📁 Songs → Open song file, and pick my-song.json.
 * The format is described in docs/SONG_FORMAT.md. No dependencies: plain Node 18+.
 */

// ---------- small helpers ----------

/** Ids only need to be unique inside the song, so readable ones are fine. */
const ids = new Map();
function id(base) {
  const n = (ids.get(base) ?? 0) + 1;
  ids.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

const COLORS = ['#ff6b6b', '#ffb84d', '#ffe066', '#5ee6a8', '#4dc9ff', '#a78bfa', '#ff7ac6'];

function baseTrack(kind, name, extra = {}) {
  return {
    id: id(name.toLowerCase().replace(/\W+/g, '-')),
    name,
    color: COLORS[ids.size % COLORS.length],
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

/** A drum / one-shot track: plays pattern `steps`. */
function sampleTrack(name, sampleId, extra = {}) {
  return baseTrack('sample', name, {
    sample: {
      sampleId,
      melodic: false,
      rootMidi: 60,
      tone: 1,
      edit: {
        start: 0,
        end: 1,
        reverse: false,
        loop: false,
        loopStart: 0,
        tuneSemitones: 0,
        fadeOut: 0,
        normalize: false,
      },
    },
    ...extra,
  });
}

/** A synth track: plays pattern `notes`. */
function synthTrack(name, presetId, macros = {}, extra = {}) {
  return baseTrack('synth', name, {
    synth: {
      presetId,
      macros: { tone: 0.55, punch: 0.5, space: 0.2, length: 0.5, ...macros },
      advanced: {},
    },
    ...extra,
  });
}

/** Add a pattern to a track and return its id. */
function addPattern(track, { name, lengthBars = 1, stepsPerBar = 16, steps = [], notes = [] }) {
  const p = {
    id: id(`${track.id}-${name}`),
    name,
    lengthBars,
    stepsPerBar,
    steps,
    notes,
  };
  track.patterns.push(p);
  return p;
}

/** Place a pattern on the timeline at each of the given (0-based) bars. */
function place(track, pattern, bars) {
  for (const startBar of bars)
    track.blocks.push({ id: id(`${track.id}-block`), patternId: pattern.id, startBar });
}

const range = (from, to, every = 1) => {
  const out = [];
  for (let i = from; i < to; i += every) out.push(i);
  return out;
};
const hits = (indexes, velocity = 0.9, chance) =>
  indexes.map((index) =>
    chance === undefined ? { index, velocity } : { index, velocity, chance },
  );

// ---------- the song ----------

const BARS = 8;

const kick = sampleTrack('Kick', 'lib:club-kick');
place(kick, addPattern(kick, { name: 'A', steps: hits([0, 4, 8, 12], 1) }), range(0, BARS));

const hat = sampleTrack('Hi-hat', 'lib:club-hat', { volumeDb: -4, pan: 0.2, humanize: 0.4 });
const hatA = addPattern(hat, {
  name: 'A',
  // off-beat hats every bar, plus 16ths that only play half the time
  steps: [...hits([2, 6, 10, 14], 0.85), ...hits([1, 3, 5, 7, 9, 11, 13, 15], 0.4, 0.5)],
});
place(hat, hatA, range(2, BARS));

const clap = sampleTrack('Clap', 'lib:club-clap', { volumeDb: -3 });
clap.fx.push({
  id: id('clap-reverb'),
  type: 'reverb',
  enabled: true,
  params: { size: 0.4, amount: 0.25 },
});
place(clap, addPattern(clap, { name: 'A', steps: hits([4, 12], 0.9) }), range(4, BARS));

// Bass: off-beat root notes. degree 0 = the key's root (A here); the preset drops it an octave.
const bass = synthTrack('Bass', 'warm-bass', { tone: 0.45, punch: 0.7, length: 0.3 });
const bassA = addPattern(bass, {
  name: 'A',
  lengthBars: 4,
  // one bar per chord root: A, F, C, G  →  degrees 0, 5, 2, 6 (A minor)
  notes: [0, 5, 2, 6].flatMap((degree, bar) =>
    [2, 6, 10, 14].map((s) => ({ start: bar * 16 + s, length: 2, degree, velocity: 0.85 })),
  ),
});
place(bass, bassA, [0, 4]);

// Pad: a whole-bar triad per bar, pumping to the kick, with a filter that opens over 4 bars.
const pad = synthTrack(
  'Pad',
  'soft-pad',
  { tone: 0.6, space: 0.35, length: 0.6 },
  { volumeDb: -6 },
);
const padA = addPattern(pad, {
  name: 'A',
  lengthBars: 4,
  notes: [0, 5, 2, 6].flatMap((root, bar) =>
    [0, 2, 4].map((up) => ({ start: bar * 16, length: 16, degree: root + up, velocity: 0.7 })),
  ),
});
place(pad, padA, [0, 4]);
pad.duck = { sourceId: kick.id, on: true, amount: 0.7, release: 2 };
const padFilter = { id: id('pad-filter'), type: 'filter', enabled: true, params: { cutoff: 0.35 } };
pad.fx.push(padFilter);
pad.automation.push({
  id: id('pad-filter-lane'),
  target: { kind: 'fx', fxId: padFilter.id, param: 'cutoff' },
  visible: true,
  points: [
    { bar: 0, value: 0.3 },
    { bar: 4, value: 0.85 },
    { bar: 8, value: 0.85 },
  ],
});

const now = Date.now();
const song = {
  format: 'simple-sequencer-song',
  version: 1,
  id: 'example-song',
  name: 'Example House Groove',
  bpm: 124,
  swing: 0,
  key: { root: 9, scale: 'minor' }, // A minor
  lengthBars: BARS,
  tracks: [kick, hat, clap, bass, pad],
  createdAt: now,
  updatedAt: now,
};

process.stdout.write(JSON.stringify(song, null, 2) + '\n');
