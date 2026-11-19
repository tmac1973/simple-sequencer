import type { Block, Pattern, StepsPerBar, Track } from './types';

export const BEATS_PER_BAR = 4;

export function stepsPerBeat(spb: StepsPerBar): number {
  return spb / BEATS_PER_BAR;
}

export function stepDurationBeats(spb: StepsPerBar): number {
  return BEATS_PER_BAR / spb;
}

/** Odd 16th steps are delayed; triplet grids are never swung. */
export function swingOffsetBeats(stepIndex: number, spb: StepsPerBar, swing: number): number {
  if (spb !== 16 || stepIndex % 2 === 0) return 0;
  return swing * 0.25 * 0.5;
}

export function beatSeconds(bpm: number): number {
  return 60 / bpm;
}

export function barSeconds(bpm: number): number {
  return beatSeconds(bpm) * BEATS_PER_BAR;
}

export function totalSteps(p: Pattern): number {
  return p.lengthBars * p.stepsPerBar;
}

export interface BlockHit {
  block: Block;
  pattern: Pattern;
}

/**
 * The block (and pattern) playing at `bar`. Later-starting blocks cut off earlier ones,
 * so overlapping blocks resolve to the latest start ≤ bar that still covers it.
 */
export function blockAt(track: Track, bar: number): BlockHit | null {
  let best: BlockHit | null = null;
  for (const block of track.blocks) {
    if (block.startBar > bar) continue;
    const pattern = track.patterns.find((p) => p.id === block.patternId);
    if (!pattern) continue;
    if (bar >= block.startBar + pattern.lengthBars) continue;
    if (!best || block.startBar > best.block.startBar) best = { block, pattern };
  }
  return best;
}
