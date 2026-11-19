import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { triggerSample } from './voices/sampleVoice';
import { DEFAULT_SAMPLE_EDIT } from '@/model/factories';

function rampBuffer(): AudioBuffer {
  // 1 s: silent first half, loud second half
  const b = new AudioBuffer({ length: 44100, numberOfChannels: 1, sampleRate: 44100 });
  const d = b.getChannelData(0);
  for (let i = 22050; i < 44100; i++) d[i] = Math.sin(i / 3) * 0.8;
  return b;
}

const energy = (d: Float32Array, a: number, b: number) => {
  let s = 0;
  for (let i = Math.floor(a * 44100); i < Math.floor(b * 44100); i++) s += d[i]! * d[i]!;
  return s;
};

describe('sample voice', () => {
  it('reverse plays the loud half first; trim shortens it', async () => {
    const buf = rampBuffer();
    const settings = {
      sampleId: 'x',
      melodic: false,
      rootMidi: 60,
      tone: 1,
      edit: { ...DEFAULT_SAMPLE_EDIT, reverse: true, start: 0, end: 1 },
    };
    const out = await Tone.Offline(
      () => {
        const g = new Tone.Gain().toDestination();
        triggerSample(g, buf, 0, 1, settings);
      },
      1.1,
      1,
      44100,
    );
    const d = out.getChannelData(0);
    expect(energy(d, 0, 0.45)).toBeGreaterThan(energy(d, 0.55, 1) * 10);

    const trimmed = {
      ...settings,
      edit: { ...settings.edit, reverse: false, start: 0.5, end: 0.75 },
    };
    const out2 = await Tone.Offline(
      () => {
        const g = new Tone.Gain().toDestination();
        triggerSample(g, buf, 0, 1, trimmed);
      },
      1.1,
      1,
      44100,
    );
    const d2 = out2.getChannelData(0);
    expect(energy(d2, 0, 0.2)).toBeGreaterThan(0.1);
    expect(energy(d2, 0.3, 1)).toBeLessThan(1e-6);
  });
});
