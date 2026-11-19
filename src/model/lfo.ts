import { valueAt } from './automation';
import type { AutomationLane, LfoSettings, LfoShape, Track } from './types';

/*
 * Wobble (LFO) maths. Everything is a pure function of the song position, so live playback,
 * export and the timeline drawing always agree.
 */

/** Length of one wobble cycle, in beats: 1/16 note … 8 bars. */
export const LFO_RATES = [0.25, 0.5, 1, 2, 4, 8, 16, 32] as const;
export const LFO_RATE_LABELS = [
  '1/16 note',
  '1/8 note',
  '1/4 note (a beat)',
  '1/2 note',
  '1 bar',
  '2 bars',
  '4 bars',
  '8 bars',
];
export const LFO_RATE_SHORT = ['1/16', '1/8', '1/4', '1/2', '1 bar', '2 bars', '4 bars', '8 bars'];

export const LFO_SHAPES: { id: LfoShape; label: string }[] = [
  { id: 'sine', label: 'Smooth' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'square', label: 'Square (on/off)' },
  { id: 'rampUp', label: 'Ramp up' },
  { id: 'rampDown', label: 'Ramp down' },
  { id: 'random', label: 'Random steps' },
];

export const DEFAULT_LFO: LfoSettings = { shape: 'sine', rate: 2, depth: 0.5, center: 0.5 };

/** Shapes with instant jumps (scheduled as steps, not ramps). */
export const isSteppy = (s: LfoShape) => s === 'square' || s === 'random';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const frac = (v: number) => v - Math.floor(v);

/** A repeatable pseudo-random number in −1…1 for cycle `n` of lane `seed`. */
function hashRandom(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
}

/** Shape value in −1…1 at a position measured in cycles (0 = start of the song). */
export function shapeAt(shape: LfoShape, cycles: number, seed = ''): number {
  const p = frac(cycles);
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'triangle':
      return 1 - 4 * Math.abs(frac(p + 0.25) - 0.5);
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'rampUp':
      return 2 * p - 1;
    case 'rampDown':
      return 1 - 2 * p;
    case 'random':
      return hashRandom(seed, Math.floor(cycles));
  }
}

/** The lanes that automate a wobble lane's amount and speed. */
export function lfoControlLanes(track: Track, laneId: string) {
  const of = (param: 'amount' | 'speed') =>
    track.automation.find(
      (l) =>
        l.target.kind === 'lfo' &&
        l.target.laneId === laneId &&
        l.target.param === param &&
        l.points.length > 0,
    );
  return { amount: of('amount'), speed: of('speed') };
}

/** Speed lane value (0–1) → a step of LFO_RATES. */
export const rateIndexOf = (v: number) => Math.round(clamp01(v) * (LFO_RATES.length - 1));

const cycleCache = new WeakMap<AutomationLane, Map<number, number[]>>();

/**
 * How many wobble cycles have happened by `beat`. With a speed lane the speed can change at
 * every beat; the phase keeps going smoothly (no jumps), because cycles are added up beat by beat.
 */
export function cyclesAt(lfo: LfoSettings, beat: number, speedLane?: AutomationLane): number {
  if (!speedLane) return beat / LFO_RATES[lfo.rate]!;
  const whole = Math.floor(beat);
  let byRate = cycleCache.get(speedLane);
  if (!byRate) cycleCache.set(speedLane, (byRate = new Map()));
  const prefix = byRate.get(lfo.rate) ?? [0];
  for (let b = prefix.length - 1; b < whole; b++)
    prefix.push(prefix[b]! + 1 / LFO_RATES[rateIndexOf(valueAt(speedLane, b / 4)!)]!);
  byRate.set(lfo.rate, prefix);
  const rate = LFO_RATES[rateIndexOf(valueAt(speedLane, whole / 4)!)]!;
  return prefix[whole]! + (beat - whole) / rate;
}

/** The knob value (0–1) a wobble lane gives at a song beat. */
export function lfoValue(track: Track, lane: AutomationLane, beat: number): number {
  const lfo = lane.lfo ?? DEFAULT_LFO;
  const { amount, speed } = lfoControlLanes(track, lane.id);
  const depth = lfo.depth * (amount ? valueAt(amount, beat / 4)! : 1);
  const s = shapeAt(lfo.shape, cyclesAt(lfo, beat, speed), lane.id);
  return clamp01(lfo.center + (depth / 2) * s);
}

/** Is this lane wobbling (rather than following its drawn points)? */
export const isLfoLane = (lane: AutomationLane) => lane.mode === 'lfo';
