import { create } from 'zustand';
import { engine, type LiveHandle } from '@/audio/engine';
import { ensureAudioStarted } from '@/audio/context';
import { usesNotes } from '@/audio/scheduler';
import { useSongStore } from '@/store/songStore';

/**
 * Live playing from the computer keyboard or a MIDI keyboard. Each held key is a "source"
 * ('key:KeyA', 'midi:60'); pressing sounds the track at once, releasing lets go.
 * The recorder listens to finished notes and hits.
 */

export interface LiveNote {
  trackId: string;
  /** scale degree (notes), or undefined (a drum hit) */
  degree?: number;
  velocity: number;
  /** song beat (as heard) when pressed and released; null when not playing */
  startBeat: number | null;
  endBeat: number | null;
}

interface Held {
  trackId: string;
  degree?: number;
  velocity: number;
  handle: LiveHandle | null;
  startBeat: number | null;
}

/** Which degrees are held on which track, for highlighting. */
export const useLiveHeld = create<{ held: Record<string, number[]>; hits: Record<string, number> }>(
  () => ({ held: {}, hits: {} }),
);

const held = new Map<string, Held>();
const listeners = new Set<(n: LiveNote, phase: 'on' | 'off') => void>();
/** sustain pedal: notes released while it's down keep sounding until it lifts */
let sustain = false;
const sustained = new Set<string>();

export function onLiveNote(fn: (n: LiveNote, phase: 'on' | 'off') => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function heardBeat(): number | null {
  return engine.position()?.beat ?? null;
}

function publish() {
  const map: Record<string, number[]> = {};
  for (const h of held.values()) if (h.degree !== undefined) (map[h.trackId] ??= []).push(h.degree);
  useLiveHeld.setState({ held: map });
}

export function liveNoteOn(
  source: string,
  trackId: string,
  degree: number | undefined,
  velocity: number,
) {
  if (held.has(source)) liveNoteOff(source, true);
  const track = useSongStore.getState().song.tracks.find((t) => t.id === trackId);
  if (!track) return;
  const note = usesNotes(track);
  const d = note ? degree : undefined;
  if (note && d === undefined) return;
  void ensureAudioStarted();
  const handle = engine.liveOn(trackId, d, velocity);
  const startBeat = heardBeat();
  if (note) {
    held.set(source, { trackId, degree: d, velocity, handle, startBeat });
    publish();
  } else {
    useLiveHeld.setState((s) => ({ hits: { ...s.hits, [trackId]: (s.hits[trackId] ?? 0) + 1 } }));
  }
  const ev: LiveNote = {
    trackId,
    degree: d,
    velocity,
    startBeat,
    endBeat: note ? null : startBeat,
  };
  listeners.forEach((l) => l(ev, 'on'));
  if (!note) listeners.forEach((l) => l(ev, 'off'));
}

export function liveNoteOff(source: string, force = false) {
  const h = held.get(source);
  if (!h) return;
  if (sustain && !force) {
    sustained.add(source);
    return;
  }
  held.delete(source);
  sustained.delete(source);
  if (h.handle) engine.liveOff(h.handle);
  publish();
  const ev: LiveNote = {
    trackId: h.trackId,
    degree: h.degree,
    velocity: h.velocity,
    startBeat: h.startBeat,
    endBeat: heardBeat(),
  };
  listeners.forEach((l) => l(ev, 'off'));
}

export function setSustain(down: boolean) {
  sustain = down;
  if (!down) for (const s of [...sustained]) liveNoteOff(s);
}

/** Let go of everything (window lost focus, track changed…). */
export function liveAllOff() {
  sustain = false;
  for (const s of [...held.keys()]) liveNoteOff(s, true);
}
