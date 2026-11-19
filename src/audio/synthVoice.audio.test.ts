import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { SynthVoice } from './voices/synthVoice';
import { createSynthTrack } from '@/model/factories';
import { midiToFreq } from '@/model/scale';

function dominantFreq(data: Float32Array, sr: number): number {
  // zero-crossing estimate over the steady middle part
  let crossings = 0;
  const from = Math.floor(data.length * 0.2);
  const to = Math.floor(data.length * 0.7);
  for (let i = from + 1; i < to; i++) if (data[i - 1]! <= 0 && data[i]! > 0) crossings++;
  return crossings / ((to - from) / sr);
}

describe('synth voice', () => {
  it('plays the expected pitch', async () => {
    const t = createSynthTrack({ presetId: 'sub-bass', macros: { tone: 1, space: 0 } });
    const midi = 57; // A3 → with octaveShift -1 → A2 = 110 Hz
    const out = await Tone.Offline(
      () => {
        const dest = new Tone.Gain().toDestination();
        const v = new SynthVoice(t.synth!, dest);
        v.trigger(midi, 0.8, 0, 1);
      },
      0.8,
      1,
      44100,
    );
    const f = dominantFreq(out.getChannelData(0), 44100);
    expect(Math.abs(f - midiToFreq(midi - 12)) / midiToFreq(midi - 12)).toBeLessThan(0.02);
  });
});
