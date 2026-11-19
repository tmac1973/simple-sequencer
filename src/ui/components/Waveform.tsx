import { useEffect, useRef, useState } from 'react';
import { SampleRegistry } from '@/audio/sampleRegistry';
import { computePeaks } from '../lib/peaks';

/** Canvas waveform of a sample id; draws a flat line while loading. */
export function Waveform({
  sampleId,
  color,
  height = 46,
  reverse = false,
}: {
  sampleId: string;
  color: string;
  height?: number;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ id: string; buf: AudioBuffer | null } | null>(null);
  const buf = loaded?.id === sampleId ? loaded.buf : (SampleRegistry.getLoaded(sampleId) ?? null);
  useEffect(() => {
    let live = true;
    SampleRegistry.get(sampleId)
      .then((b) => live && setLoaded({ id: sampleId, buf: b }))
      .catch(() => live && setLoaded({ id: sampleId, buf: null }));
    return () => {
      live = false;
    };
  }, [sampleId]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.clientWidth * devicePixelRatio);
    const h = (c.height = height * devicePixelRatio);
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, w, h);
    g.fillStyle = color;
    if (!buf) {
      g.fillRect(0, h / 2, w, 1);
      return;
    }
    const n = Math.floor(w / (2 * devicePixelRatio));
    const peaks = computePeaks(buf, n);
    for (let i = 0; i < n; i++) {
      const p = peaks[reverse ? n - 1 - i : i]!;
      const bh = Math.max(1, p * h * 0.92);
      g.fillRect(i * 2 * devicePixelRatio, (h - bh) / 2, devicePixelRatio * 1.4, bh);
    }
  }, [buf, color, height, reverse]);
  return <canvas ref={ref} style={{ width: '100%', height, display: 'block' }} aria-hidden />;
}
