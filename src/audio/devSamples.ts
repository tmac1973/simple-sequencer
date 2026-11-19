import { SampleRegistry } from './sampleRegistry';

/** Code-generated test sounds so the engine works before (and without) the sample library. */
const SR = 44100;

async function render(
  seconds: number,
  build: (ctx: OfflineAudioContext) => void,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * SR), SR);
  build(ctx);
  return ctx.startRendering();
}

function noise(ctx: OfflineAudioContext, seconds: number): AudioBufferSourceNode {
  const b = ctx.createBuffer(1, Math.ceil(seconds * SR), SR);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = b;
  return src;
}

export const DEV_SAMPLES: Record<string, () => Promise<AudioBuffer>> = {
  'dev:kick': () =>
    render(0.5, (ctx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(160, 0);
      o.frequency.exponentialRampToValueAtTime(42, 0.12);
      g.gain.setValueAtTime(1, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.48);
      o.connect(g).connect(ctx.destination);
      o.start(0);
    }),
  'dev:snare': () =>
    render(0.3, (ctx) => {
      const n = noise(ctx, 0.3);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 2500;
      f.Q.value = 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.25);
      n.connect(f).connect(g).connect(ctx.destination);
      n.start(0);
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.value = 190;
      og.gain.setValueAtTime(0.6, 0);
      og.gain.exponentialRampToValueAtTime(0.001, 0.12);
      o.connect(og).connect(ctx.destination);
      o.start(0);
    }),
  'dev:hat': () =>
    render(0.12, (ctx) => {
      const n = noise(ctx, 0.12);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.6, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.08);
      n.connect(f).connect(g).connect(ctx.destination);
      n.start(0);
    }),
  'dev:tone': () =>
    render(1.5, (ctx) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 261.63; // C4
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 1.45);
      o.connect(g).connect(ctx.destination);
      o.start(0);
    }),
};

export function registerDevSamples() {
  SampleRegistry.addResolver('dev', (id) => {
    const make = DEV_SAMPLES[id];
    if (!make) return Promise.reject(new Error(`Unknown dev sample ${id}`));
    return make();
  });
}
