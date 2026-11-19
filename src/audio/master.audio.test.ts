import { describe, it, expect } from 'vitest';
import * as Tone from 'tone';
import { CLIP_CEILING, createMaster } from './master';

/** Render a steady sine through the master bus. */
async function throughMaster(freq: number, db: number) {
  const out = await Tone.Offline(
    () => {
      const o = new Tone.Oscillator(freq, 'sine');
      o.volume.value = db;
      o.connect(createMaster().input);
      o.start(0);
    },
    2,
    1,
    44100,
  );
  return out.getChannelData(0).subarray(44100, 44100 + 32768);
}

/** Harmonics 2–10 relative to the fundamental, in dB. */
function thdDb(d: Float32Array, f0: number) {
  let fund = 0;
  let harm = 0;
  for (let k = 1; k <= 10; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < d.length; i++) {
      const ph = (2 * Math.PI * f0 * k * i) / 44100;
      re += d[i]! * Math.cos(ph);
      im += d[i]! * Math.sin(ph);
    }
    if (k === 1) fund = re * re + im * im;
    else harm += re * re + im * im;
  }
  return 10 * Math.log10(harm / fund);
}

const peakDb = (d: Float32Array) => 20 * Math.log10(Math.max(...Array.from(d, Math.abs)));

describe('master bus', () => {
  it('leaves quiet sounds at their own level (make-up gain is cancelled)', async () => {
    expect(peakDb(await throughMaster(220, -20))).toBeCloseTo(-20, 0);
  });

  it('keeps a loud bass note clean instead of crackling', async () => {
    // a mix 5 dB over full scale: the old 10 ms-release limiter gave about -13 dB THD here
    const d = await throughMaster(55, 5);
    expect(thdDb(d, 55)).toBeLessThan(-35);
    expect(peakDb(d)).toBeLessThanOrEqual(20 * Math.log10(CLIP_CEILING) + 0.01);
  });
});
