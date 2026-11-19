import {
  createFxSlot,
  createLane,
  createPattern,
  createSampleTrack,
  createSynthTrack,
  newId,
} from '@/model/factories';
import type {
  AutomationPoint,
  FxType,
  Note,
  Pattern,
  PatternLength,
  StepsPerBar,
  SynthMacros,
  Track,
} from '@/model/types';
import { defaultParams } from '@/audio/effects/registry';

export const hits = (idx: number[], v = 0.9): { index: number; velocity: number }[] =>
  idx.map((index) => ({ index, velocity: v }));

/** Steps with per-step velocities: [[index, velocity], …] */
export const vhits = (pairs: [number, number][]) =>
  pairs.map(([index, velocity]) => ({ index, velocity }));

export function note(start: number, length: number, degree: number, velocity = 0.8): Note {
  return { start, length, degree, velocity };
}

/** A chord: same start/length for several degrees. */
export function chord(start: number, length: number, degrees: number[], velocity = 0.7): Note[] {
  return degrees.map((d) => note(start, length, d, velocity));
}

export interface PatternSpec {
  name: string;
  len?: PatternLength;
  grid?: StepsPerBar;
  steps?: { index: number; velocity: number }[];
  notes?: Note[];
}

export function patterns(specs: PatternSpec[]): Pattern[] {
  return specs.map((s) =>
    createPattern({
      name: s.name,
      lengthBars: s.len ?? 1,
      stepsPerBar: s.grid ?? 16,
      steps: s.steps ?? [],
      notes: s.notes ?? [],
    }),
  );
}

/**
 * Place pattern blocks. `arrangement` lists [displayBar (1-based), patternName]; bars are
 * converted to the model's 0-based startBar.
 */
export function place(track: Track, arrangement: [number, string][]) {
  track.blocks = arrangement.map(([bar, name]) => {
    const p = track.patterns.find((x) => x.name === name);
    if (!p) throw new Error(`Template pattern ${name} missing on ${track.name}`);
    return { id: newId(), patternId: p.id, startBar: bar - 1 };
  });
}

/** Repeat a pattern every `every` bars from display bar `from` to `to` (inclusive). */
export function repeat(from: number, to: number, name: string, every = 1): [number, string][] {
  const out: [number, string][] = [];
  for (let b = from; b <= to; b += every) out.push([b, name]);
  return out;
}

export function addFx(track: Track, type: FxType, params: Record<string, number> = {}) {
  const slot = createFxSlot(type, { ...defaultParams(type), ...params });
  track.fx.push(slot);
  return slot;
}

/** Automation points are given in 1-based display bars too. */
export function addLane(
  track: Track,
  target: Parameters<typeof createLane>[0],
  pts: [number, number][],
) {
  const points: AutomationPoint[] = pts.map(([bar, value]) => ({ bar: bar - 1, value }));
  track.automation.push(createLane(target, points));
}

export function drumTrack(
  name: string,
  sampleId: string,
  specs: PatternSpec[],
  existing: Track[],
  opts: { volumeDb?: number; pan?: number } = {},
): Track {
  const t = createSampleTrack({ name, sampleId, patterns: patterns(specs), ...opts }, existing);
  existing.push(t);
  return t;
}

export function melodicSampleTrack(
  name: string,
  sampleId: string,
  rootMidi: number,
  specs: PatternSpec[],
  existing: Track[],
  opts: { volumeDb?: number; pan?: number } = {},
): Track {
  const t = createSampleTrack(
    { name, sampleId, melodic: true, rootMidi, patterns: patterns(specs), ...opts },
    existing,
  );
  existing.push(t);
  return t;
}

export function synthTrack(
  name: string,
  presetId: string,
  specs: PatternSpec[],
  existing: Track[],
  opts: { volumeDb?: number; pan?: number; macros?: Partial<SynthMacros> } = {},
): Track {
  const t = createSynthTrack(
    {
      name,
      presetId,
      patterns: patterns(specs),
      volumeDb: opts.volumeDb,
      pan: opts.pan,
      macros: opts.macros,
    },
    existing,
  );
  existing.push(t);
  return t;
}
