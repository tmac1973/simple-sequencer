import * as Tone from 'tone';

let started = false;

/** Must be called from a user gesture before the first sound (browser autoplay rules). */
export async function ensureAudioStarted(): Promise<void> {
  const ctx = Tone.getContext();
  if (!started) {
    ctx.lookAhead = 0;
    started = true;
  }
  if (ctx.state !== 'running') await Tone.start();
}

export function audioNow(): number {
  return Tone.getContext().currentTime;
}
