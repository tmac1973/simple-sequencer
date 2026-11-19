import * as Tone from 'tone';

let started = false;
let configured = false;

/**
 * Use the browser's "playback" audio buffer instead of the default "interactive" one. Everything
 * is scheduled ahead of time anyway, so the extra few milliseconds don't matter, and the bigger
 * buffer rides out busy moments (many synths, effects) without crackles or dropouts.
 * Call once at startup, before any sound is made.
 */
export function configureAudioContext() {
  if (configured) return;
  configured = true;
  try {
    if (typeof AudioContext === 'undefined') return;
    Tone.setContext(new Tone.Context({ latencyHint: 'playback', lookAhead: 0 }));
  } catch (e) {
    console.warn('[audio] using the default audio settings', e);
  }
}

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

/** The time of the sound coming out of the speakers right now (for the playhead). */
export function audioHeardNow(): number {
  const ctx = Tone.getContext();
  const raw = ctx.rawContext as AudioContext;
  const latency = raw.outputLatency || raw.baseLatency || 0;
  return ctx.currentTime - latency;
}
