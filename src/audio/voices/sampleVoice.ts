import * as Tone from 'tone';
import type { SampleTrackSettings } from '@/model/types';

/** Fire one sample hit. Voices dispose themselves when they finish. */
export function triggerSample(
  dest: Tone.InputNode,
  buffer: AudioBuffer,
  time: number,
  velocity: number,
  settings: SampleTrackSettings,
  rateMultiplier = 1,
  durationSec?: number,
) {
  const rate = 2 ** (settings.edit.tuneSemitones / 12) * rateMultiplier;
  const src = new Tone.ToneBufferSource({
    url: new Tone.ToneAudioBuffer(buffer),
    playbackRate: rate,
  });
  const gain = new Tone.Gain(velocity * velocity);
  src.connect(gain);
  gain.connect(dest);
  if (durationSec !== undefined) {
    // short release so cut-off notes don't click
    const end = time + durationSec;
    gain.gain.setValueAtTime(velocity * velocity, Math.max(time, end - 0.012));
    gain.gain.linearRampToValueAtTime(0, end);
  }
  src.onended = () => {
    src.dispose();
    gain.dispose();
  };
  src.start(time, 0, durationSec);
}
