import { encodeWavBytes, decodeWavBytes } from './wav';

function src(channels: Float32Array[], sampleRate = 44100) {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0]!.length,
    getChannelData: (c: number) => channels[c]!,
  };
}

describe('WAV encoder', () => {
  it('writes a valid header', () => {
    const b = encodeWavBytes(src([new Float32Array(10), new Float32Array(10)]), 16);
    const txt = (o: number) => String.fromCharCode(...b.slice(o, o + 4));
    const v = new DataView(b.buffer);
    expect(txt(0)).toBe('RIFF');
    expect(txt(8)).toBe('WAVE');
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(40);
    expect(b.length).toBe(84);
  });
  it.each([16, 24] as const)('round-trips samples at %i-bit', (bits) => {
    const x = Float32Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 0.9);
    const back = decodeWavBytes(encodeWavBytes(src([x]), bits));
    const tol = bits === 16 ? 1e-4 : 1e-6;
    back.channels[0]!.forEach((v, i) => expect(Math.abs(v - x[i]!)).toBeLessThan(tol));
  });
  it('clamps out-of-range samples', () => {
    const back = decodeWavBytes(encodeWavBytes(src([Float32Array.from([2, -2])]), 16));
    expect(back.channels[0]![0]).toBeCloseTo(1, 3);
    expect(back.channels[0]![1]).toBeCloseTo(-1, 3);
  });
});
