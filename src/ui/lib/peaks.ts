export function computePeaks(buffer: AudioBuffer, n: number): Float32Array {
  const out = new Float32Array(n);
  const ch = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(ch.length / n));
  for (let i = 0; i < n; i++) {
    let m = 0;
    const s = i * per;
    for (let j = s; j < Math.min(ch.length, s + per); j++) m = Math.max(m, Math.abs(ch[j]!));
    out[i] = m;
  }
  return out;
}
