import type * as Tone from 'tone';

/** Sample-and-hold downsampler (an AudioWorklet), for the Bitcrush effect. */
const CODE = `
class SSDownsample extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'factor', defaultValue: 1, minValue: 1, maxValue: 32 }]; }
  constructor() { super(); this.held = []; this.count = 0; }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0];
    const f = Math.max(1, Math.round(params.factor[0]));
    if (!inp || !inp.length) return true;
    for (let i = 0; i < out[0].length; i++) {
      if (this.count <= 0) {
        for (let c = 0; c < out.length; c++) this.held[c] = inp[c] ? inp[c][i] : 0;
        this.count = f;
      }
      this.count--;
      for (let c = 0; c < out.length; c++) out[c][i] = this.held[c] || 0;
    }
    return true;
  }
}
registerProcessor('ss-downsample', SSDownsample);
`;

const loaded = new WeakMap<object, Promise<void>>();
let url: string | null = null;

export interface Downsampler {
  input: AudioNode;
  output: AudioNode;
  setFactor(f: number): void;
  dispose(): void;
}

export async function createDownsampler(
  ctx: Tone.BaseContext,
  factor: number,
): Promise<Downsampler> {
  const raw = ctx.rawContext as unknown as BaseAudioContext & { audioWorklet?: AudioWorklet };
  if (!raw.audioWorklet) throw new Error('AudioWorklet not supported');
  url ??= URL.createObjectURL(new Blob([CODE], { type: 'text/javascript' }));
  let p = loaded.get(raw);
  if (!p) {
    p = raw.audioWorklet.addModule(url);
    loaded.set(raw, p);
  }
  await p;
  const node = ctx.createAudioWorkletNode('ss-downsample', {
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: 'explicit',
  } as AudioWorkletNodeOptions);
  const param = (node.parameters as unknown as Map<string, AudioParam>).get('factor')!;
  param.value = factor;
  return {
    input: node,
    output: node,
    setFactor: (f) => param.setValueAtTime(f, ctx.currentTime),
    dispose: () => node.disconnect(),
  };
}
