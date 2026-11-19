import * as Tone from 'tone';

/** −0.3 dBFS output ceiling. */
export const CLIP_CEILING = 10 ** (-0.3 / 20);
const KNEE = 0.5; // −6 dBFS: transparent below this

/** Soft clip curve: identity below the knee, tanh into the ceiling above it. */
export function softClip(x: number): number {
  const a = Math.abs(x);
  if (a <= KNEE) return x;
  const span = CLIP_CEILING - KNEE;
  return Math.sign(x) * (KNEE + span * Math.tanh((a - KNEE) / span));
}

export interface MasterBus {
  input: Tone.Gain;
  limiter: Tone.Limiter;
  clipper: Tone.WaveShaper;
  dispose(): void;
}

/** master Gain → Limiter(−3) → safety soft-clipper (≤ −0.3 dBFS) → destination. */
export function createMaster(): MasterBus {
  const input = new Tone.Gain(1);
  const limiter = new Tone.Limiter(-3);
  const clipper = new Tone.WaveShaper((v) => softClip(v), 4096);
  input.chain(limiter, clipper, Tone.getDestination());
  return {
    input,
    limiter,
    clipper,
    dispose() {
      input.dispose();
      limiter.dispose();
      clipper.dispose();
    },
  };
}
