import { dbToSlider } from './mixing';
import type { AutomationLane, AutomationPoint, AutomationTarget, Track } from './types';

/** Stable key for a target, e.g. "track:volume", "fx:<slot>:cutoff". */
export function targetKey(t: AutomationTarget): string {
  switch (t.kind) {
    case 'track':
      return `track:${t.param}`;
    case 'synthMacro':
      return `macro:${t.macro}`;
    case 'sampleTone':
      return 'sampleTone';
    case 'fx':
      return `fx:${t.fxId}:${t.param}`;
  }
}

function sorted(lane: AutomationLane): AutomationPoint[] {
  return lane.points;
}

/**
 * Lane value at a (fractional) bar: linear between points; before the first point it holds the
 * first value, after the last it holds the last. At a vertical step (two points on the same bar)
 * this returns the later point's value.
 */
export function valueAt(lane: AutomationLane, bar: number): number | null {
  const pts = sorted(lane);
  if (!pts.length) return null;
  if (bar < pts[0]!.bar) return pts[0]!.value;
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]!;
    if (p.bar <= bar) {
      const n = pts[i + 1];
      if (!n || n.bar === p.bar) return p.value;
      return p.value + ((n.value - p.value) * (bar - p.bar)) / (n.bar - p.bar);
    }
  }
  return pts[pts.length - 1]!.value;
}

/** Points strictly after `from` and up to (and including) `to`, in order. */
export function pointsBetween(lane: AutomationLane, from: number, to: number): AutomationPoint[] {
  return lane.points.filter((p) => p.bar > from && p.bar <= to);
}

/** The knob's current (non-automated) value, normalized 0–1. */
export function targetStatic(track: Track, t: AutomationTarget, fxDefault = 0.5): number {
  switch (t.kind) {
    case 'track':
      return t.param === 'volume' ? dbToSlider(track.volumeDb) : (track.pan + 1) / 2;
    case 'synthMacro':
      return track.synth?.macros[t.macro] ?? 0.5;
    case 'sampleTone':
      return track.sample?.tone ?? 1;
    case 'fx':
      return track.fx.find((f) => f.id === t.fxId)?.params[t.param] ?? fxDefault;
  }
}

/** Remove lanes whose effect no longer exists. */
export function pruneLanes(track: Track): AutomationLane[] {
  const ids = new Set(track.fx.map((f) => f.id));
  return track.automation.filter((l) => l.target.kind !== 'fx' || ids.has(l.target.fxId));
}
