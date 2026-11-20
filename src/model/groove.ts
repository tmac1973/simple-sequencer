import type { DuckSettings, Track } from './types';

/** Duck release times, in beats: 1/16, 1/8, 1/4 and 1/2 note. */
export const DUCK_RELEASES = [0.25, 0.5, 1, 2] as const;
export const DUCK_RELEASE_LABELS = ['1/16 note', '1/8 note', '1/4 note', '1/2 note'];
/** How quickly the volume dips at each hit (seconds). */
export const DUCK_ATTACK = 0.005;

export const PUMP_PRESET = { amount: 0.7, release: 2 } as const;

export function defaultDuck(sourceId: string): DuckSettings {
  return { sourceId, on: true, ...PUMP_PRESET };
}

/** The track that most likely holds the kick drum, for "Pump to the kick". */
export function kickTrack(tracks: Track[], exceptId?: string): Track | undefined {
  const others = tracks.filter(
    (t) => t.id !== exceptId && t.kind === 'sample' && !t.sample?.melodic,
  );
  return (
    others.find((t) => /kick|bd\b|bass ?drum/i.test(`${t.name} ${t.sample?.sampleId ?? ''}`)) ??
    undefined
  );
}

/** The default source to offer for ducking: the kick, else the first drum track, else any other. */
export function defaultDuckSource(tracks: Track[], trackId: string): Track | undefined {
  return (
    kickTrack(tracks, trackId) ??
    tracks.find((t) => t.id !== trackId && t.kind === 'sample' && !t.sample?.melodic) ??
    tracks.find((t) => t.id !== trackId)
  );
}

// ---- repeatable randomness (chance and humanize) ----

/** 32-bit string hash (FNV-1a). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A repeatable random number in [0, 1) for these integers (a small integer hash). */
export function rand01(seed: number, a: number, b: number, c: number): number {
  let h = seed ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x297a2d39) ^ Math.imul(c + 0x1b873593, 0x27d4eb2f);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Timing nudge for humanize at 100%: up to ±12 ms. */
export const HUMANIZE_MAX_SEC = 0.012;
/** Loudness nudge for humanize at 100%: up to ±20%. */
export const HUMANIZE_MAX_VEL = 0.2;

export interface HitKey {
  /** hash of the track id */
  seed: number;
  /** absolute song bar of the hit */
  bar: number;
  /** step index within the pattern */
  step: number;
  /** how many times playback has looped (0 = first time through) */
  pass: number;
}

/** Does a step/note with this chance play this time? */
export function plays(chance: number | undefined, k: HitKey): boolean {
  if (chance === undefined || chance >= 1) return true;
  return rand01(k.seed, k.bar, k.step, k.pass * 2) < chance;
}

/**
 * Humanize a hit: returns a timing nudge (seconds) and a velocity multiplier.
 * Hits on the beat move half as far, so the groove stays tight.
 */
export function humanizeHit(
  amount: number,
  k: HitKey,
  onBeat: boolean,
): { dt: number; vel: number } {
  if (!amount) return { dt: 0, vel: 1 };
  const r1 = rand01(k.seed, k.bar, k.step, k.pass * 2 + 1) * 2 - 1;
  const r2 = rand01(k.seed ^ 0x5bd1e995, k.bar, k.step, k.pass) * 2 - 1;
  const t = onBeat ? 0.5 : 1;
  return { dt: r1 * HUMANIZE_MAX_SEC * amount * t, vel: 1 + r2 * HUMANIZE_MAX_VEL * amount };
}
