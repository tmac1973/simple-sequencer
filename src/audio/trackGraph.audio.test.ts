import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { GraphSet } from './engine';
import { FX_ORDER, defaultParams } from './effects/registry';
import { createFxSlot, createSampleTrack, createSong } from '@/model/factories';
import type { Song } from '@/model/types';
import { triggerSample } from './voices/sampleVoice';

function noiseBuf() {
  const b = new AudioBuffer({ length: 22050, numberOfChannels: 1, sampleRate: 44100 });
  const d = b.getChannelData(0);
  let s = 1;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647;
    d[i] = (s / 2147483647 - 0.5) * 0.8;
  }
  return b;
}

async function render(song: Song, dur = 1) {
  const buf = noiseBuf();
  return Tone.Offline(
    async () => {
      const g = new GraphSet(song);
      await g.ready();
      const t = song.tracks[0]!;
      triggerSample(g.sampleInput(t.id)!, buf, 0.05, 1, t.sample!);
    },
    dur,
    2,
    44100,
  );
}
const rms = (b: Tone.ToneAudioBuffer, from = 0, to = 1) => {
  const d = b.getChannelData(0);
  let s = 0;
  const a = Math.floor(from * d.length);
  const z = Math.floor(to * d.length);
  for (let i = a; i < z; i++) s += d[i]! * d[i]!;
  return Math.sqrt(s / (z - a));
};

describe('effect chains (offline)', () => {
  it('every effect renders sound and none breaks the chain', async () => {
    for (const type of FX_ORDER) {
      const t = createSampleTrack();
      t.fx = [createFxSlot(type, defaultParams(type))];
      const out = await render(createSong({ tracks: [t] }));
      expect(rms(out), type).toBeGreaterThan(0.005);
    }
  });
  it('a disabled effect is bypassed', async () => {
    const t = createSampleTrack();
    const slot = createFxSlot('filter', { ...defaultParams('filter'), cutoff: 0 });
    t.fx = [slot];
    const filtered = rms(await render(createSong({ tracks: [t] })));
    t.fx = [{ ...slot, enabled: false }];
    const bypassed = rms(await render(createSong({ tracks: [t] })));
    expect(bypassed).toBeGreaterThan(filtered * 3);
  });
  it('reverb adds a tail after the dry sound ends', async () => {
    const t = createSampleTrack();
    const dry = rms(await render(createSong({ tracks: [t] }), 1.5), 0.6, 1);
    t.fx = [createFxSlot('reverb', { ...defaultParams('reverb'), size: 0.8, amount: 0.8 })];
    const wet = rms(await render(createSong({ tracks: [t] }), 1.5), 0.6, 1);
    expect(dry).toBeLessThan(1e-4);
    expect(wet).toBeGreaterThan(0.001);
  });
  it('order matters: filter→distortion differs from distortion→filter', async () => {
    const a = createFxSlot('filter', { ...defaultParams('filter'), cutoff: 0.3 });
    const b = createFxSlot('distortion', { ...defaultParams('distortion'), drive: 1, amount: 1 });
    const t = createSampleTrack();
    t.fx = [a, b];
    const one = rms(await render(createSong({ tracks: [t] })));
    t.fx = [b, a];
    const two = rms(await render(createSong({ tracks: [t] })));
    expect(Math.abs(one - two)).toBeGreaterThan(0.002);
  });
});
