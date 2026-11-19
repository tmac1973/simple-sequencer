import { MAX_VOLUME_DB, MIN_VOLUME_DB } from './constants';

export const DEFAULT_VOLUME_DB = 0;

/** Slider position p (0–1) → dB. p = 1 → +6 dB, p ≈ 0.708 → 0 dB, p = 0.5 → −6 dB. */
export function sliderToDb(p: number): number {
  if (p <= 0) return -Infinity;
  return Math.min(MAX_VOLUME_DB, 20 * Math.log10(p * p) + 6);
}

/** dB → slider position (0–1); inverse of sliderToDb. */
export function dbToSlider(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_VOLUME_DB) return 0;
  return Math.min(1, Math.sqrt(10 ** ((db - 6) / 20)));
}

/** Store-safe dB (clamps −Infinity to the minimum, which means silence). */
export function clampDb(db: number): number {
  if (!Number.isFinite(db)) return MIN_VOLUME_DB;
  return Math.max(MIN_VOLUME_DB, Math.min(MAX_VOLUME_DB, db));
}

/** Gain multiplier for a stored dB value; MIN_VOLUME_DB counts as silence. */
export function dbToGain(db: number): number {
  if (db <= MIN_VOLUME_DB) return 0;
  return 10 ** (db / 20);
}
