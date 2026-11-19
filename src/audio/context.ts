import * as Tone from 'tone';

let started = false;

export class AudioUnavailableError extends Error {
  constructor() {
    super(
      "Sound couldn't start in this browser. Try clicking Play again, or use the latest Chrome, Firefox or Safari.",
    );
    this.name = 'AudioUnavailableError';
  }
}

/**
 * Must be called from a user gesture before the first sound (browser autoplay rules). Also
 * resumes a context the browser suspended (e.g. Safari after the tab was in the background).
 */
export async function ensureAudioStarted(): Promise<void> {
  let ctx: Tone.BaseContext;
  try {
    ctx = Tone.getContext();
  } catch {
    throw new AudioUnavailableError();
  }
  if (!started) {
    ctx.lookAhead = 0;
    started = true;
  }
  if (ctx.state !== 'running') {
    try {
      await Tone.start();
    } catch {
      throw new AudioUnavailableError();
    }
  }
}

export function audioNow(): number {
  return Tone.getContext().currentTime;
}
