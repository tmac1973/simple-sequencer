/** MP3 encoding with lamejs (LGPL-3.0, loaded unmodified as its own chunk). */
export async function encodeMp3Pcm(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  kbps: number,
  onProgress?: (p: number) => void,
  shouldStop?: () => boolean,
): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(2, sampleRate, kbps);
  const toI16 = (f: Float32Array, a: number, b: number) => {
    const out = new Int16Array(b - a);
    for (let i = a; i < b; i++) {
      const s = Math.max(-1, Math.min(1, f[i]!));
      out[i - a] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152 * 20;
  for (let i = 0; i < left.length; i += BLOCK) {
    if (shouldStop?.()) throw new DOMException('Export cancelled', 'AbortError');
    const end = Math.min(left.length, i + BLOCK);
    const mp3 = enc.encodeBuffer(toI16(left, i, end), toI16(right, i, end));
    if (mp3.length) chunks.push(new Uint8Array(mp3));
    onProgress?.(end / left.length);
  }
  const last = enc.flush();
  if (last.length) chunks.push(new Uint8Array(last));
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
