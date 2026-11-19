import { describe, it, expect } from 'vitest';

describe('web audio test environment', () => {
  it('renders an oscillator offline', async () => {
    const ctx = new OfflineAudioContext(1, 4410, 44100);
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.start();
    const buf = await ctx.startRendering();
    const data = buf.getChannelData(0);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.5);
  });
});
