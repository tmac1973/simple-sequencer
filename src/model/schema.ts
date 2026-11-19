import { MAX_SONG_BARS } from './constants';
import { SCALES } from './scale';
import type {
  AutomationLane,
  AutomationTarget,
  FxSlot,
  FxType,
  Note,
  OscType,
  Pattern,
  Song,
  Step,
  SynthAdvanced,
  Track,
} from './types';

export class SongFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SongFormatError';
  }
}

const FX_TYPES: FxType[] = [
  'reverb',
  'delay',
  'filter',
  'distortion',
  'compressor',
  'eq',
  'chorus',
  'bitcrush',
];
const OSC_TYPES: OscType[] = [
  'sine',
  'triangle',
  'sawtooth',
  'square',
  'fmsine',
  'fatsawtooth',
  'fatsquare',
  'fattriangle',
  'amsine',
  'fmsquare',
];

type Obj = Record<string, unknown>;

function fail(path: string, what: string): never {
  throw new SongFormatError(`This song file looks damaged: ${path} ${what}.`);
}
function obj(v: unknown, path: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(path, 'should be an object');
  return v as Obj;
}
function arr(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, 'should be a list');
  return v;
}
function str(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, 'should be text');
  return v;
}
function num(v: unknown, path: string, lo = -Infinity, hi = Infinity): number {
  if (typeof v !== 'number' || Number.isNaN(v)) fail(path, 'should be a number');
  if (v < lo || v > hi) fail(path, `should be between ${lo} and ${hi}`);
  return v;
}
function bool(v: unknown, path: string): boolean {
  if (typeof v !== 'boolean') fail(path, 'should be true or false');
  return v;
}
function oneOf<T extends string | number>(v: unknown, opts: readonly T[], path: string): T {
  if (!opts.includes(v as T)) fail(path, `should be one of ${opts.join(', ')}`);
  return v as T;
}

function step(v: unknown, p: string): Step {
  const o = obj(v, p);
  return { index: num(o.index, `${p}.index`, 0), velocity: num(o.velocity, `${p}.velocity`, 0, 1) };
}
function note(v: unknown, p: string): Note {
  const o = obj(v, p);
  return {
    start: num(o.start, `${p}.start`, 0),
    length: num(o.length, `${p}.length`, 1),
    degree: num(o.degree, `${p}.degree`, -64, 64),
    velocity: num(o.velocity, `${p}.velocity`, 0, 1),
  };
}
function patternOf(v: unknown, p: string): Pattern {
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    name: str(o.name, `${p}.name`),
    lengthBars: oneOf(o.lengthBars, [1, 2, 3, 4] as const, `${p}.lengthBars`),
    stepsPerBar: oneOf(o.stepsPerBar, [16, 24] as const, `${p}.stepsPerBar`),
    steps: arr(o.steps, `${p}.steps`).map((s, i) => step(s, `${p}.steps[${i}]`)),
    notes: arr(o.notes, `${p}.notes`).map((n, i) => note(n, `${p}.notes[${i}]`)),
  };
}
function fxOf(v: unknown, p: string): FxSlot {
  const o = obj(v, p);
  const params: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj(o.params, `${p}.params`)))
    params[k] = num(val, `${p}.params.${k}`, 0, 1);
  return {
    id: str(o.id, `${p}.id`),
    type: oneOf(o.type, FX_TYPES, `${p}.type`),
    enabled: bool(o.enabled, `${p}.enabled`),
    params,
  };
}
function targetOf(v: unknown, p: string): AutomationTarget {
  const o = obj(v, p);
  switch (o.kind) {
    case 'track':
      return { kind: 'track', param: oneOf(o.param, ['volume', 'pan'] as const, `${p}.param`) };
    case 'synthMacro':
      return {
        kind: 'synthMacro',
        macro: oneOf(o.macro, ['tone', 'space'] as const, `${p}.macro`),
      };
    case 'sampleTone':
      return { kind: 'sampleTone' };
    case 'fx':
      return { kind: 'fx', fxId: str(o.fxId, `${p}.fxId`), param: str(o.param, `${p}.param`) };
    default:
      fail(`${p}.kind`, 'is not a known automation target');
  }
}
function laneOf(v: unknown, p: string): AutomationLane {
  const o = obj(v, p);
  return {
    id: str(o.id, `${p}.id`),
    target: targetOf(o.target, `${p}.target`),
    visible: bool(o.visible, `${p}.visible`),
    points: arr(o.points, `${p}.points`).map((pt, i) => {
      const q = obj(pt, `${p}.points[${i}]`);
      return {
        bar: num(q.bar, `${p}.points[${i}].bar`, 0),
        value: num(q.value, `${p}.points[${i}].value`, 0, 1),
      };
    }),
  };
}
function trackOf(v: unknown, p: string): Track {
  const o = obj(v, p);
  const kind = oneOf(o.kind, ['sample', 'synth'] as const, `${p}.kind`);
  const patterns = arr(o.patterns, `${p}.patterns`).map((x, i) =>
    patternOf(x, `${p}.patterns[${i}]`),
  );
  if (patterns.length === 0) fail(`${p}.patterns`, 'should have at least one pattern');
  const ids = new Set(patterns.map((x) => x.id));
  const blocks = arr(o.blocks, `${p}.blocks`)
    .map((b, i) => {
      const q = obj(b, `${p}.blocks[${i}]`);
      return {
        id: str(q.id, `${p}.blocks[${i}].id`),
        patternId: str(q.patternId, `${p}.blocks[${i}].patternId`),
        startBar: num(q.startBar, `${p}.blocks[${i}].startBar`, 0, MAX_SONG_BARS - 1),
      };
    })
    // drop blocks pointing to missing patterns
    .filter((b) => ids.has(b.patternId));
  const fx = arr(o.fx, `${p}.fx`).map((x, i) => fxOf(x, `${p}.fx[${i}]`));
  const fxIds = new Set(fx.map((f) => f.id));
  const automation = arr(o.automation, `${p}.automation`)
    .map((x, i) => laneOf(x, `${p}.automation[${i}]`))
    .filter((l) => l.target.kind !== 'fx' || fxIds.has(l.target.fxId));
  const t: Track = {
    id: str(o.id, `${p}.id`),
    name: str(o.name, `${p}.name`),
    color: str(o.color, `${p}.color`),
    kind,
    volumeDb: num(o.volumeDb, `${p}.volumeDb`, -60, 6),
    pan: num(o.pan, `${p}.pan`, -1, 1),
    mute: bool(o.mute, `${p}.mute`),
    solo: bool(o.solo, `${p}.solo`),
    patterns,
    blocks,
    fx,
    automation,
  };
  if (kind === 'sample') {
    const s = obj(o.sample, `${p}.sample`);
    const e = obj(s.edit, `${p}.sample.edit`);
    t.sample = {
      sampleId: str(s.sampleId, `${p}.sample.sampleId`),
      melodic: bool(s.melodic, `${p}.sample.melodic`),
      rootMidi: num(s.rootMidi, `${p}.sample.rootMidi`, 0, 127),
      tone: num(s.tone, `${p}.sample.tone`, 0, 1),
      edit: {
        start: num(e.start, 'edit.start', 0, 1),
        end: num(e.end, 'edit.end', 0, 1),
        reverse: bool(e.reverse, 'edit.reverse'),
        loop: bool(e.loop, 'edit.loop'),
        loopStart: num(e.loopStart, 'edit.loopStart', 0, 1),
        tuneSemitones: num(e.tuneSemitones, 'edit.tuneSemitones', -24, 24),
        fadeOut: num(e.fadeOut, 'edit.fadeOut', 0, 1),
        normalize: bool(e.normalize, 'edit.normalize'),
      },
    };
  } else {
    const s = obj(o.synth, `${p}.synth`);
    const m = obj(s.macros, `${p}.synth.macros`);
    const adv = obj(s.advanced ?? {}, `${p}.synth.advanced`);
    const advanced: Partial<SynthAdvanced> = {};
    for (const [k, val] of Object.entries(adv)) {
      if (k === 'oscType') advanced.oscType = oneOf(val, OSC_TYPES, `${p}.synth.advanced.oscType`);
      else (advanced as Record<string, number>)[k] = num(val, `${p}.synth.advanced.${k}`);
    }
    t.synth = {
      presetId: str(s.presetId, `${p}.synth.presetId`),
      macros: {
        tone: num(m.tone, 'macros.tone', 0, 1),
        punch: num(m.punch, 'macros.punch', 0, 1),
        space: num(m.space, 'macros.space', 0, 1),
        length: num(m.length, 'macros.length', 0, 1),
      },
      advanced,
    };
  }
  return t;
}

/** Validate an unknown value as a Song. Throws SongFormatError with a readable message. */
export function validateSong(raw: unknown): Song {
  const o = obj(raw, 'song');
  if (o.format !== 'simple-sequencer-song')
    throw new SongFormatError("This isn't a Simple Sequencer song file.");
  if (o.version !== 1) fail('version', 'is not supported');
  const key = obj(o.key, 'key');
  return {
    format: 'simple-sequencer-song',
    version: 1,
    id: str(o.id, 'id'),
    name: str(o.name, 'name'),
    bpm: num(o.bpm, 'bpm', 40, 220),
    swing: num(o.swing, 'swing', 0, 0.75),
    key: {
      root: num(key.root, 'key.root', 0, 11),
      scale: oneOf(key.scale, Object.keys(SCALES) as Song['key']['scale'][], 'key.scale'),
    },
    lengthBars: num(o.lengthBars, 'lengthBars', 1, MAX_SONG_BARS),
    tracks: arr(o.tracks, 'tracks').map((t, i) => trackOf(t, `tracks[${i}]`)),
    createdAt: num(o.createdAt, 'createdAt'),
    updatedAt: num(o.updatedAt, 'updatedAt'),
  };
}

export const CURRENT_SONG_VERSION = 1;

/** Upgrade older song versions to the current one. v1 is the first version. */
export function migrateSong(raw: unknown): unknown {
  const o = obj(raw, 'song');
  if (typeof o.version === 'number' && o.version > CURRENT_SONG_VERSION) {
    throw new SongFormatError(
      'This song was made with a newer version of Simple Sequencer. Please update the app.',
    );
  }
  return o;
}
