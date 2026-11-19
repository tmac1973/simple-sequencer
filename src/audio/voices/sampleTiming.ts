import type { SampleEdit } from '@/model/types';

export interface HitTiming {
  /** seconds into the (possibly reversed) buffer where playback starts */
  offset: number;
  /** real-time seconds the hit lasts */
  playDur: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  /** real-time seconds after start when the fade-out begins (= playDur when no fade) */
  fadeStart: number;
}

/**
 * Where to play inside a sample for one hit, given the non-destructive edit settings.
 * `holdSec` is how long the note/step lasts (needed for loops and melodic notes).
 */
export function computeHitTiming(
  edit: SampleEdit,
  bufferDur: number,
  rate: number,
  holdSec?: number,
): HitTiming {
  const a = Math.max(0, Math.min(1, Math.min(edit.start, edit.end)));
  const b = Math.max(a + 0.001, Math.min(1, Math.max(edit.start, edit.end)));
  // In reverse the region is mirrored onto the reversed buffer.
  const rs = edit.reverse ? 1 - b : a;
  const re = edit.reverse ? 1 - a : b;
  const offset = rs * bufferDur;
  const regionReal = ((re - rs) * bufferDur) / rate;
  const loop = edit.loop && holdSec !== undefined;
  let ls = Math.max(a, Math.min(b - 0.001, edit.loopStart));
  if (edit.reverse) ls = 1 - b; // reversed loops restart at the (mirrored) region start
  const playDur = loop
    ? holdSec!
    : holdSec !== undefined
      ? Math.min(regionReal, holdSec)
      : regionReal;
  const fade = Math.max(0, Math.min(1, edit.fadeOut));
  return {
    offset,
    playDur,
    loop,
    loopStart: ls * bufferDur,
    loopEnd: re * bufferDur,
    fadeStart: playDur * (1 - fade),
  };
}

export function toneToHz(tone: number): number {
  return 300 * (20000 / 300) ** Math.max(0, Math.min(1, tone));
}
