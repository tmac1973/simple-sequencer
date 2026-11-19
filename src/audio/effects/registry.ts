import * as Tone from 'tone';
import type { FxType } from '@/model/types';
import { createDownsampler, type Downsampler } from './downsample';

export interface ParamDef {
  key: string;
  label: string;
  /** 0–1 */
  default: number;
  format: (v: number) => string;
  /** discrete choice parameter, mapped evenly across 0–1 */
  choices?: string[];
  tip?: string;
}

export interface FxInstance {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  /** set a normalized 0–1 param */
  set(key: string, v: number, rampSec?: number): void;
  /** schedule a ramp of a continuous param to v at `time` (automation) */
  rampAt?(key: string, v: number, time: number): void;
  setTempo?(bpm: number): void;
  /** resolves when async parts (reverb impulse, worklets) are ready */
  ready: Promise<void>;
  dispose(): void;
}

export interface FxDef {
  type: FxType;
  name: string;
  emoji: string;
  blurb: string;
  main: ParamDef[];
  advanced: ParamDef[];
  create(params: Record<string, number>, bpm: number): FxInstance;
}

const expMap = (v: number, lo: number, hi: number) => lo * (hi / lo) ** v;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const ms = (s: number) => (s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`);
const db = (d: number) => `${d > 0 ? '+' : ''}${d.toFixed(1)} dB`;
const hz = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)} kHz` : `${Math.round(f)} Hz`);
export const choiceIndex = (v: number, n: number) =>
  Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
const p = (params: Record<string, number>, defs: ParamDef[], key: string) =>
  params[key] ?? defs.find((d) => d.key === key)?.default ?? 0.5;

/** Delay times, in beats: 1/16, 1/8, 3/16, 1/4, 3/8, 1/2 */
export const DELAY_BEATS = [0.25, 0.5, 0.75, 1, 1.5, 2];
export const DELAY_LABELS = ['1/16', '1/8', '3/16', '1/4', '3/8', '1/2'];

/** Every def's params (main + advanced). */
export const allParams = (d: FxDef) => [...d.main, ...d.advanced];

const reverb: FxDef = {
  type: 'reverb',
  name: 'Reverb',
  emoji: '🏛️',
  blurb: 'Makes it sound like a room or hall',
  main: [
    {
      key: 'size',
      label: 'Size',
      default: 0.5,
      format: (v) => (v < 0.35 ? 'Room' : v < 0.7 ? 'Hall' : 'Huge'),
    },
    { key: 'amount', label: 'Amount', default: 0.3, format: pct },
  ],
  advanced: [{ key: 'predelay', label: 'Pre-delay', default: 0.1, format: (v) => ms(v * 0.1) }],
  create(params) {
    const defs = allParams(reverb);
    const r = new Tone.Reverb({
      decay: expMap(p(params, defs, 'size'), 0.5, 8),
      preDelay: p(params, defs, 'predelay') * 0.1,
      wet: p(params, defs, 'amount'),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready: Promise<void> = r.ready;
    return {
      input: r,
      output: r,
      get ready() {
        return ready;
      },
      set(key, v, ramp = 0.03) {
        if (key === 'amount') r.wet.rampTo(v, ramp);
        if (key === 'size' || key === 'predelay') {
          const apply = () => {
            if (key === 'size') r.decay = expMap(v, 0.5, 8);
            else r.preDelay = v * 0.1;
            ready = r.generate().then(() => undefined);
          };
          if (r.context instanceof Tone.OfflineContext) apply();
          else {
            clearTimeout(timer);
            timer = setTimeout(apply, 300);
          }
        }
      },
      rampAt(key, v, time) {
        if (key === 'amount') r.wet.linearRampToValueAtTime(v, time);
      },
      dispose() {
        clearTimeout(timer);
        r.dispose();
      },
    } as FxInstance;
  },
};

const delay: FxDef = {
  type: 'delay',
  name: 'Delay',
  emoji: '🔁',
  blurb: 'Echoes that repeat in time with the song',
  main: [
    {
      key: 'time',
      label: 'Time',
      default: 0.4,
      format: (v) => DELAY_LABELS[choiceIndex(v, DELAY_BEATS.length)]!,
    },
    { key: 'amount', label: 'Amount', default: 0.25, format: pct },
  ],
  advanced: [
    { key: 'feedback', label: 'Repeats', default: 0.4, format: (v) => pct(v * 0.85) },
    {
      key: 'pingpong',
      label: 'Ping-pong',
      default: 0,
      format: (v) => (v > 0.5 ? 'On' : 'Off'),
      choices: ['Off', 'On'],
      tip: 'Ping-pong|Echoes bounce between the left and right speakers.',
    },
  ],
  create(params, bpm) {
    const defs = allParams(delay);
    const input = new Tone.Gain(1);
    const output = new Tone.Gain(1);
    let tempo = bpm;
    let state = {
      ...Object.fromEntries(defs.map((d) => [d.key, p(params, defs, d.key)])),
    } as Record<string, number>;
    const seconds = () => (DELAY_BEATS[choiceIndex(state.time!, DELAY_BEATS.length)]! * 60) / tempo;
    let node: Tone.FeedbackDelay | Tone.PingPongDelay;
    const build = () => {
      const opts = {
        delayTime: seconds(),
        feedback: state.feedback! * 0.85,
        wet: state.amount!,
        maxDelay: 4,
      };
      node = state.pingpong! > 0.5 ? new Tone.PingPongDelay(opts) : new Tone.FeedbackDelay(opts);
      input.connect(node);
      node.connect(output);
    };
    build();
    return {
      input,
      output,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        state = { ...state, [key]: v };
        if (key === 'pingpong') {
          input.disconnect(node);
          const old = node;
          build();
          setTimeout(() => old.dispose(), 2000);
        } else if (key === 'amount') node.wet.rampTo(v, ramp);
        else if (key === 'feedback') node.feedback.rampTo(v * 0.85, ramp);
        else if (key === 'time') node.delayTime.rampTo(seconds(), 0.05);
      },
      rampAt(key, v, time) {
        if (key === 'amount') node.wet.linearRampToValueAtTime(v, time);
        if (key === 'feedback') node.feedback.linearRampToValueAtTime(v * 0.85, time);
      },
      setTempo(b) {
        if (b === tempo) return;
        tempo = b;
        node.delayTime.rampTo(seconds(), 0.05);
      },
      dispose() {
        node.dispose();
        input.dispose();
        output.dispose();
      },
    };
  },
};

const FILTER_TYPES = ['lowpass', 'highpass', 'bandpass'] as const;
export const cutoffHz = (v: number) => expMap(v, 40, 18000);
const filter: FxDef = {
  type: 'filter',
  name: 'Filter',
  emoji: '🌗',
  blurb: 'Make it darker or thinner',
  main: [
    {
      key: 'cutoff',
      label: 'Cutoff',
      default: 0.6,
      format: (v) => (v < 0.3 ? `Darker · ${hz(cutoffHz(v))}` : hz(cutoffHz(v))),
    },
    {
      key: 'resonance',
      label: 'Resonance',
      default: 0.2,
      format: (v) => expMap(v, 0.5, 15).toFixed(1),
    },
  ],
  advanced: [
    {
      key: 'type',
      label: 'Type',
      default: 0,
      format: (v) => ['Low-pass', 'High-pass', 'Band-pass'][choiceIndex(v, 3)]!,
      choices: ['Low-pass', 'High-pass', 'Band-pass'],
      tip: 'Filter type|Low-pass cuts highs (darker), high-pass cuts lows (thinner), band-pass keeps the middle.',
    },
  ],
  create(params) {
    const defs = allParams(filter);
    const f = new Tone.Filter({
      type: FILTER_TYPES[choiceIndex(p(params, defs, 'type'), 3)],
      frequency: cutoffHz(p(params, defs, 'cutoff')),
      Q: expMap(p(params, defs, 'resonance'), 0.5, 15),
      rolloff: -24,
    });
    return {
      input: f,
      output: f,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        if (key === 'cutoff') f.frequency.rampTo(cutoffHz(v), ramp);
        if (key === 'resonance') f.Q.rampTo(expMap(v, 0.5, 15), ramp);
        if (key === 'type') f.type = FILTER_TYPES[choiceIndex(v, 3)]!;
      },
      rampAt(key, v, time) {
        if (key === 'cutoff') f.frequency.exponentialRampToValueAtTime(cutoffHz(v), time);
        if (key === 'resonance') f.Q.linearRampToValueAtTime(expMap(v, 0.5, 15), time);
      },
      dispose: () => void f.dispose(),
    };
  },
};

const OVERSAMPLE = ['none', '2x', '4x'] as const;
const distortion: FxDef = {
  type: 'distortion',
  name: 'Distortion',
  emoji: '🔥',
  blurb: 'Grit, warmth or crunch',
  main: [
    { key: 'drive', label: 'Drive', default: 0.4, format: pct },
    { key: 'amount', label: 'Amount', default: 0.5, format: pct },
  ],
  advanced: [
    {
      key: 'oversample',
      label: 'Smoothing',
      default: 0.5,
      format: (v) => ['Off', '2×', '4×'][choiceIndex(v, 3)]!,
      choices: ['Off', '2×', '4×'],
      tip: 'Smoothing|Higher smoothing sounds cleaner but uses more computer power.',
    },
  ],
  create(params) {
    const defs = allParams(distortion);
    const d = new Tone.Distortion({
      distortion: p(params, defs, 'drive'),
      wet: p(params, defs, 'amount'),
      oversample: OVERSAMPLE[choiceIndex(p(params, defs, 'oversample'), 3)],
    });
    return {
      input: d,
      output: d,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        if (key === 'drive') d.distortion = v;
        if (key === 'amount') d.wet.rampTo(v, ramp);
        if (key === 'oversample') d.oversample = OVERSAMPLE[choiceIndex(v, 3)]!;
      },
      rampAt(key, v, time) {
        if (key === 'amount') d.wet.linearRampToValueAtTime(v, time);
      },
      dispose: () => void d.dispose(),
    };
  },
};

const compressor: FxDef = {
  type: 'compressor',
  name: 'Compressor',
  emoji: '🗜️',
  blurb: 'Evens out loud and quiet parts so it sounds tighter',
  main: [
    { key: 'squash', label: 'Squash', default: 0.5, format: pct },
    { key: 'makeup', label: 'Boost', default: 0.3, format: (v) => db(v * 12) },
  ],
  advanced: [
    { key: 'attack', label: 'Attack', default: 0.35, format: (v) => ms(expMap(v, 0.001, 0.3)) },
    { key: 'release', label: 'Release', default: 0.4, format: (v) => ms(expMap(v, 0.02, 1)) },
  ],
  create(params) {
    const defs = allParams(compressor);
    const c = new Tone.Compressor({
      threshold: -40 * p(params, defs, 'squash'),
      ratio: 2 + 6 * p(params, defs, 'squash'),
      attack: expMap(p(params, defs, 'attack'), 0.001, 0.3),
      release: expMap(p(params, defs, 'release'), 0.02, 1),
    });
    const g = new Tone.Gain(Tone.dbToGain(12 * p(params, defs, 'makeup')));
    c.connect(g);
    return {
      input: c,
      output: g,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        if (key === 'squash') {
          c.threshold.rampTo(-40 * v, ramp);
          c.ratio.rampTo(2 + 6 * v, ramp);
        }
        if (key === 'makeup') g.gain.rampTo(Tone.dbToGain(12 * v), ramp);
        if (key === 'attack') c.attack.rampTo(expMap(v, 0.001, 0.3), ramp);
        if (key === 'release') c.release.rampTo(expMap(v, 0.02, 1), ramp);
      },
      rampAt(key, v, time) {
        if (key === 'makeup') g.gain.linearRampToValueAtTime(Tone.dbToGain(12 * v), time);
      },
      dispose() {
        c.dispose();
        g.dispose();
      },
    };
  },
};

const eqGain = (v: number) => -12 + 24 * v;
const eq: FxDef = {
  type: 'eq',
  name: 'EQ',
  emoji: '🎚️',
  blurb: 'Turn up or down the lows, mids and highs',
  main: [
    { key: 'low', label: 'Low', default: 0.5, format: (v) => db(eqGain(v)) },
    { key: 'high', label: 'High', default: 0.5, format: (v) => db(eqGain(v)) },
  ],
  advanced: [
    { key: 'mid', label: 'Mid', default: 0.5, format: (v) => db(eqGain(v)) },
    { key: 'lowFreq', label: 'Low edge', default: 0.4, format: (v) => hz(expMap(v, 100, 800)) },
    { key: 'highFreq', label: 'High edge', default: 0.5, format: (v) => hz(expMap(v, 1500, 9000)) },
  ],
  create(params) {
    const defs = allParams(eq);
    const e = new Tone.EQ3({
      low: eqGain(p(params, defs, 'low')),
      mid: eqGain(p(params, defs, 'mid')),
      high: eqGain(p(params, defs, 'high')),
      lowFrequency: expMap(p(params, defs, 'lowFreq'), 100, 800),
      highFrequency: expMap(p(params, defs, 'highFreq'), 1500, 9000),
    });
    return {
      input: e,
      output: e,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        if (key === 'low' || key === 'mid' || key === 'high') e[key].rampTo(eqGain(v), ramp);
        if (key === 'lowFreq') e.lowFrequency.rampTo(expMap(v, 100, 800), ramp);
        if (key === 'highFreq') e.highFrequency.rampTo(expMap(v, 1500, 9000), ramp);
      },
      rampAt(key, v, time) {
        if (key === 'low' || key === 'mid' || key === 'high')
          e[key].linearRampToValueAtTime(eqGain(v), time);
      },
      dispose: () => void e.dispose(),
    };
  },
};

const chorus: FxDef = {
  type: 'chorus',
  name: 'Chorus',
  emoji: '🌊',
  blurb: 'Wide, shimmering, doubled sound',
  main: [
    { key: 'width', label: 'Width', default: 0.5, format: pct },
    { key: 'amount', label: 'Amount', default: 0.5, format: pct },
  ],
  advanced: [
    {
      key: 'rate',
      label: 'Speed',
      default: 0.3,
      format: (v) => `${expMap(v, 0.1, 8).toFixed(1)} Hz`,
    },
  ],
  create(params) {
    const defs = allParams(chorus);
    const c = new Tone.Chorus({
      frequency: expMap(p(params, defs, 'rate'), 0.1, 8),
      delayTime: 3.5,
      depth: p(params, defs, 'width'),
      wet: p(params, defs, 'amount'),
    }).start();
    return {
      input: c,
      output: c,
      ready: Promise.resolve(),
      set(key, v, ramp = 0.03) {
        if (key === 'width') c.depth = v;
        if (key === 'amount') c.wet.rampTo(v, ramp);
        if (key === 'rate') c.frequency.rampTo(expMap(v, 0.1, 8), ramp);
      },
      rampAt(key, v, time) {
        if (key === 'amount') c.wet.linearRampToValueAtTime(v, time);
      },
      dispose: () => void c.dispose(),
    };
  },
};

export const crushBits = (v: number) => Math.round(16 - 14 * v);
export const downFactor = (v: number) => 1 + Math.round(19 * v);
const bitcrush: FxDef = {
  type: 'bitcrush',
  name: 'Bitcrush',
  emoji: '👾',
  blurb: 'Lo-fi, retro, crunchy digital sound',
  main: [
    { key: 'crush', label: 'Crush', default: 0.5, format: (v) => `${crushBits(v)}-bit` },
    { key: 'amount', label: 'Amount', default: 0.5, format: pct },
  ],
  advanced: [
    {
      key: 'down',
      label: 'Downsample',
      default: 0,
      format: (v) => (downFactor(v) === 1 ? 'Off' : `${downFactor(v)}×`),
    },
  ],
  create(params) {
    const defs = allParams(bitcrush);
    const input = new Tone.Gain(1);
    const output = new Tone.Gain(1);
    const dry = new Tone.Gain(1 - p(params, defs, 'amount'));
    const wet = new Tone.Gain(p(params, defs, 'amount'));
    const crusher = new Tone.BitCrusher({ bits: crushBits(p(params, defs, 'crush')) });
    crusher.wet.value = 1;
    input.connect(dry);
    dry.connect(output);
    input.connect(crusher);
    let ds: Downsampler | null = null;
    const ready = createDownsampler(Tone.getContext(), downFactor(p(params, defs, 'down')))
      .then((d) => {
        ds = d;
        crusher.connect(d.input);
        Tone.connect(d.output, wet);
      })
      .catch(() => {
        // Worklets unavailable: skip downsampling.
        crusher.connect(wet);
      });
    wet.connect(output);
    return {
      input,
      output,
      ready,
      set(key, v, ramp = 0.03) {
        if (key === 'crush') crusher.bits.value = crushBits(v);
        if (key === 'amount') {
          dry.gain.rampTo(1 - v, ramp);
          wet.gain.rampTo(v, ramp);
        }
        if (key === 'down') ds?.setFactor(downFactor(v));
      },
      rampAt(key, v, time) {
        if (key === 'amount') {
          dry.gain.linearRampToValueAtTime(1 - v, time);
          wet.gain.linearRampToValueAtTime(v, time);
        }
      },
      dispose() {
        input.dispose();
        output.dispose();
        dry.dispose();
        wet.dispose();
        crusher.dispose();
        ds?.dispose();
      },
    };
  },
};

export const FX_DEFS: Record<FxType, FxDef> = {
  reverb,
  delay,
  filter,
  distortion,
  compressor,
  eq,
  chorus,
  bitcrush,
};
export const FX_ORDER: FxType[] = [
  'reverb',
  'delay',
  'filter',
  'distortion',
  'compressor',
  'eq',
  'chorus',
  'bitcrush',
];

export function defaultParams(type: FxType): Record<string, number> {
  return Object.fromEntries(allParams(FX_DEFS[type]).map((d) => [d.key, d.default]));
}
