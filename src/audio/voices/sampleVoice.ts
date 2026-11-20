import * as Tone from 'tone';
import type { SampleTrackSettings } from '@/model/types';
import { computeHitTiming } from './sampleTiming';

const reversed = new WeakMap<AudioBuffer, AudioBuffer>();
const peaks = new WeakMap<AudioBuffer, number>();

function reversedOf(buf: AudioBuffer): AudioBuffer {
  let r = reversed.get(buf);
  if (!r) {
    r = new AudioBuffer({
      length: buf.length,
      numberOfChannels: buf.numberOfChannels,
      sampleRate: buf.sampleRate,
    });
    for (let c = 0; c < buf.numberOfChannels; c++)
      r.getChannelData(c).set(buf.getChannelData(c).slice().reverse());
    reversed.set(buf, r);
  }
  return r;
}

export function peakOf(buf: AudioBuffer): number {
  let p = peaks.get(buf);
  if (p === undefined) {
    p = 0;
    for (let c = 0; c < buf.numberOfChannels; c++)
      for (const v of buf.getChannelData(c)) p = Math.max(p, Math.abs(v));
    peaks.set(buf, p);
  }
  return p;
}

/**
 * Fire one sample hit with all non-destructive edits applied (trim, reverse, tune, loop,
 * fade-out, normalize). `holdSec` = note/step length (cuts melodic notes, drives loops).
 * Voices dispose themselves when they finish.
 */
export function triggerSample(
  dest: Tone.InputNode,
  buffer: AudioBuffer,
  time: number,
  velocity: number,
  settings: SampleTrackSettings,
  rateMultiplier = 1,
  holdSec?: number,
): { stop(time: number): void } | undefined {
  const e = settings.edit;
  const rate = 2 ** (e.tuneSemitones / 12) * rateMultiplier;
  const buf = e.reverse ? reversedOf(buffer) : buffer;
  const t = computeHitTiming(e, buffer.duration, rate, holdSec);
  if (t.playDur <= 0.001) return undefined;
  const src = new Tone.ToneBufferSource({
    url: new Tone.ToneAudioBuffer(buf),
    playbackRate: rate,
    loop: t.loop,
    loopStart: t.loopStart,
    loopEnd: t.loopEnd,
  });
  const norm = e.normalize ? Math.min(16, 0.89 / Math.max(1e-4, peakOf(buffer))) : 1;
  const level = velocity * velocity * norm;
  const gain = new Tone.Gain(level);
  src.connect(gain);
  gain.connect(dest);
  const end = time + t.playDur;
  const fadeStart = Math.min(time + t.fadeStart, end - 0.012);
  gain.gain.setValueAtTime(level, Math.max(time, fadeStart));
  gain.gain.linearRampToValueAtTime(0, end);
  // Offline renders (export) fire callbacks before rendering audio, so voices must not
  // dispose themselves there; the whole offline context is thrown away afterwards.
  if (!(src.context instanceof Tone.OfflineContext)) {
    src.onended = () => {
      src.dispose();
      gain.dispose();
    };
  }
  src.start(time, t.offset);
  src.stop(end + 0.005);
  return {
    /** let go early (a live note released): a quick fade, then stop */
    stop(at: number) {
      if (at >= end) return;
      gain.gain.cancelScheduledValues(at);
      gain.gain.setValueAtTime(level, at);
      gain.gain.linearRampToValueAtTime(0, at + 0.04);
      src.stop(at + 0.05);
    },
  };
}
