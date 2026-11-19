/** Vertical scroll shared between the track list and the timeline. */
const listeners = new Set<(top: number) => void>();
export function emitScroll(top: number) {
  listeners.forEach((l) => l(top));
}
export function onScroll(fn: (top: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
