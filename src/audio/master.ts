import * as Tone from 'tone';

/** −0.3 dBFS output ceiling. */
export const CLIP_CEILING = 10 ** (-0.3 / 20);
/** The safety clipper is transparent below −1.5 dBFS: it only rounds off rare overs. */
const KNEE = 10 ** (-1.5 / 20);

/** Soft clip curve: identity below the knee, tanh into the ceiling above it. */
export function softClip(x: number): number {
  const a = Math.abs(x);
  if (a <= KNEE) return x;
  const span = CLIP_CEILING - KNEE;
  return Math.sign(x) * (KNEE + span * Math.tanh((a - KNEE) / span));
}

/**
 * Limiter settings. A hard knee (no gradual compression of quiet parts) and a slow release, so
 * the gain never wobbles within a bass note's waveform (which sounds like crackle).
 */
export const LIMIT = { threshold: -4, ratio: 20, knee: 0, attack: 0.003, release: 0.25 };

/**
 * Web Audio compressors add automatic make-up gain (spec: (1 / fullRangeGain) ^ 0.6), which
 * would push everything back up into the clipper. This is that gain in dB, to cancel it.
 */
export function makeupDb({ threshold, ratio }: { threshold: number; ratio: number }): number {
  const fullRangeDb = threshold - threshold / ratio; // output at 0 dBFS input, hard knee
  return -0.6 * fullRangeDb;
}

export interface MasterBus {
  input: Tone.Gain;
  limiter: Tone.Compressor;
  clipper: Tone.WaveShaper;
  dispose(): void;
}

/** master Gain → limiter (−4 dB, slow release) → make-up cancel → safety clipper → destination. */
export function createMaster(): MasterBus {
  const input = new Tone.Gain(1);
  const limiter = new Tone.Compressor(LIMIT);
  const trim = new Tone.Gain(-makeupDb(LIMIT), 'decibels');
  const clipper = new Tone.WaveShaper((v) => softClip(v), 4096);
  input.chain(limiter, trim, clipper, Tone.getDestination());
  return {
    input,
    limiter,
    clipper,
    dispose() {
      input.dispose();
      limiter.dispose();
      trim.dispose();
      clipper.dispose();
    },
  };
}
