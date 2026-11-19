/**
 * The complete, serializable song model. Bars are 0-based here; the UI shows them 1-based.
 * Everything in a Song is plain JSON so it can be saved, diffed and undone.
 */

export type Id = string;

export type ScaleName =
  | 'major'
  | 'minor'
  | 'dorian'
  | 'mixolydian'
  | 'harmonicMinor'
  | 'majorPentatonic'
  | 'minorPentatonic';

export interface SongKey {
  /** 0 = C … 11 = B */
  root: number;
  scale: ScaleName;
}

export interface Song {
  format: 'simple-sequencer-song';
  version: 1;
  id: Id;
  name: string;
  /** 40–220 */
  bpm: number;
  /** 0–0.75 */
  swing: number;
  key: SongKey;
  /** 1–128 */
  lengthBars: number;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export type TrackKind = 'sample' | 'synth';

export interface Track {
  id: Id;
  name: string;
  color: string;
  kind: TrackKind;
  /** -60 … +6 dB (−Infinity is stored as -60 and treated as silent) */
  volumeDb: number;
  /** -1 … 1 */
  pan: number;
  mute: boolean;
  solo: boolean;
  patterns: Pattern[];
  blocks: Block[];
  fx: FxSlot[];
  automation: AutomationLane[];
  sample?: SampleTrackSettings;
  synth?: SynthTrackSettings;
}

export interface SampleEdit {
  /** 0–1 fraction of the sample */
  start: number;
  /** 0–1 fraction of the sample, > start */
  end: number;
  reverse: boolean;
  loop: boolean;
  /** 0–1 fraction of the sample, between start and end */
  loopStart: number;
  /** -24 … 24 (the inspector's "Pitch" knob) */
  tuneSemitones: number;
  /** 0–1 portion of the hit that fades out (the inspector's "Decay" knob; 0 = no fade) */
  fadeOut: number;
  normalize: boolean;
}

export interface SampleTrackSettings {
  sampleId: string;
  melodic: boolean;
  /** MIDI note of the sample's recorded pitch (default 60) */
  rootMidi: number;
  edit: SampleEdit;
  /** 0–1 lowpass "Tone" (1 = fully open) */
  tone: number;
}

export type OscType =
  | 'sine'
  | 'triangle'
  | 'sawtooth'
  | 'square'
  | 'fmsine'
  | 'fatsawtooth'
  | 'fatsquare'
  | 'fattriangle'
  | 'amsine'
  | 'fmsquare';

export interface SynthAdvanced {
  oscType: OscType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoffHz: number;
  filterQ: number;
  filterEnvAmount: number;
  vibratoRate: number;
  vibratoDepth: number;
  glide: number;
}

export interface SynthMacros {
  tone: number;
  punch: number;
  space: number;
  length: number;
}

export interface SynthTrackSettings {
  presetId: string;
  macros: SynthMacros;
  advanced: Partial<SynthAdvanced>;
}

export type StepsPerBar = 16 | 24;
export type PatternLength = 1 | 2 | 3 | 4;

export interface Step {
  index: number;
  /** 0.1–1 */
  velocity: number;
}

export interface Note {
  /** step index within the pattern */
  start: number;
  /** in steps, ≥ 1 */
  length: number;
  /** scale degree; 0 = key root in octave 3 */
  degree: number;
  velocity: number;
}

export interface Pattern {
  id: Id;
  name: string;
  lengthBars: PatternLength;
  stepsPerBar: StepsPerBar;
  steps: Step[];
  notes: Note[];
}

export interface Block {
  id: Id;
  patternId: Id;
  startBar: number;
}

export type FxType =
  'reverb' | 'delay' | 'filter' | 'distortion' | 'compressor' | 'eq' | 'chorus' | 'bitcrush';

export interface FxSlot {
  id: Id;
  type: FxType;
  enabled: boolean;
  /** all values normalized 0–1 */
  params: Record<string, number>;
}

/**
 * Only Tone and Space are automatable synth macros: Punch and Length set envelope
 * times, which aren't continuous audio parameters, so they're static knobs.
 */
export type AutomationTarget =
  | { kind: 'track'; param: 'volume' | 'pan' }
  | { kind: 'synthMacro'; macro: 'tone' | 'space' }
  | { kind: 'sampleTone' }
  | { kind: 'fx'; fxId: Id; param: string };

export interface AutomationPoint {
  /** fractional, 0 ≤ bar ≤ lengthBars */
  bar: number;
  /** 0–1 */
  value: number;
}

export interface AutomationLane {
  id: Id;
  target: AutomationTarget;
  points: AutomationPoint[];
  visible: boolean;
}
