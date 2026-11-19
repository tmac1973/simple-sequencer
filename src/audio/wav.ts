/** Minimal AudioBuffer-like shape (so the encoder is testable without Web Audio). */
export interface PcmSource {
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  getChannelData(ch: number): Float32Array;
}

/** Encode PCM as a little-endian WAV file (16- or 24-bit integer). */
export function encodeWavBytes(buf: PcmSource, bitDepth: 16 | 24 = 16): Uint8Array {
  const ch = buf.numberOfChannels;
  const bytesPer = bitDepth / 8;
  const dataLen = buf.length * ch * bytesPer;
  const out = new Uint8Array(44 + dataLen);
  const v = new DataView(out.buffer);
  const str = (o: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * bytesPer, true);
  v.setUint16(32, ch * bytesPer, true);
  v.setUint16(34, bitDepth, true);
  str(36, 'data');
  v.setUint32(40, dataLen, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  const max = bitDepth === 16 ? 0x7fff : 0x7fffff;
  for (let i = 0; i < buf.length; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c]![i]!));
      const n = Math.round(s < 0 ? s * (max + 1) : s * max);
      if (bitDepth === 16) v.setInt16(o, n, true);
      else {
        v.setUint8(o, n & 0xff);
        v.setUint8(o + 1, (n >> 8) & 0xff);
        v.setUint8(o + 2, (n >> 16) & 0xff);
      }
      o += bytesPer;
    }
  }
  return out;
}

export function encodeWav(buf: PcmSource, bitDepth: 16 | 24 = 16): Blob {
  return new Blob([encodeWavBytes(buf, bitDepth) as BlobPart], { type: 'audio/wav' });
}

/** Parse a PCM WAV (16/24-bit) back to float channels (tests and round-trips). */
export function decodeWavBytes(bytes: Uint8Array): {
  sampleRate: number;
  channels: Float32Array[];
} {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ch = v.getUint16(22, true);
  const sampleRate = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  const len = v.getUint32(40, true) / (ch * (bits / 8));
  const channels = Array.from({ length: ch }, () => new Float32Array(len));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      let n: number;
      if (bits === 16) {
        n = v.getInt16(o, true) / 0x8000;
        o += 2;
      } else {
        let x = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);
        if (x & 0x800000) x -= 0x1000000;
        n = x / 0x800000;
        o += 3;
      }
      channels[c]![i] = n;
    }
  }
  return { sampleRate, channels };
}
