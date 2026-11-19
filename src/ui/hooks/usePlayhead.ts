import { useEffect, useState } from 'react';
import { engine, type PlayPosition } from '@/audio/engine';
import { useUiStore } from '@/store/uiStore';

/** Calls `fn` every animation frame while playing (null when stopped). No React re-render. */
export function usePlayheadFrame(fn: (pos: PlayPosition | null) => void) {
  const playing = useUiStore((s) => s.playing);
  useEffect(() => {
    if (!playing) {
      fn(null);
      return;
    }
    let raf = 0;
    const loop = () => {
      fn(engine.position());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      fn(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);
}

/** A value derived from the play position, re-rendering only when it changes. */
export function usePlayDerived<T>(derive: (pos: PlayPosition | null) => T): T {
  const [v, setV] = useState<T>(() => derive(null));
  usePlayheadFrame((pos) => {
    const next = derive(pos);
    setV((prev) => (Object.is(prev, next) ? prev : next));
  });
  return v;
}
