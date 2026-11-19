import { describe, it, expect } from 'vitest';
import { encodeMp3Pcm } from './mp3core';

describe('mp3 encoder', () => {
  it('encodes a 440 Hz sine that decodes back to ~1 s at 440 Hz', async () => {
    const sr = 44100;
    const x = Float32Array.from(
      { length: sr },
      (_, i) => Math.sin((2 * Math.PI * 440 * i) / sr) * 0.5,
    );
    const bytes = await encodeMp3Pcm(x, x, sr, 192);
    expect(bytes.length).toBeGreaterThan(10_000);
    const ctx = new OfflineAudioContext(1, 1, sr);
    const buf = await ctx.decodeAudioData(bytes.slice().buffer);
    expect(Math.abs(buf.duration - 1)).toBeLessThan(0.05);
    const d = buf.getChannelData(0);
    let crossings = 0;
    for (let i = 4411; i < 4411 + 22050; i++) if (d[i - 1]! <= 0 && d[i]! > 0) crossings++;
    expect(Math.abs(crossings / 0.5 - 440) / 440).toBeLessThan(0.02);
  });
});
