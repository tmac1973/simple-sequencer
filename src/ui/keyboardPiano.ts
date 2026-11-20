import { useEffect } from 'react';
import { create } from 'zustand';
import { scaleLength } from '@/model/scale';
import { usesNotes } from '@/audio/scheduler';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import type { Track } from '@/model/types';
import { liveAllOff, liveNoteOff, liveNoteOn } from './livePlay';

/**
 * Play the selected track from the computer keyboard, always in key:
 * A S D F G H J K L ; = the next ten scale notes from the key's root,
 * Q W E R T Y U I O P = the same an octave up, Z / X = octave down / up.
 * Keys are matched by position (KeyboardEvent.code), so other layouts work too.
 */
export const LOWER_ROW = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
] as const;
export const UPPER_ROW = [
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
] as const;
const LABEL = (code: string) => (code === 'Semicolon' ? ';' : code.slice(3));

export const KEYS_VELOCITY = 0.8;
export const MIN_OCTAVE = -2;
export const MAX_OCTAVE = 2;

/** The keyboard's octave shift (Z / X). */
export const useKeysOctave = create<{ octave: number }>(() => ({ octave: 0 }));

/** The scale degree a key plays, or null if it isn't a note key. */
export function keyDegree(code: string, octave: number, scaleLen: number): number | null {
  const lo = (LOWER_ROW as readonly string[]).indexOf(code);
  if (lo >= 0) return lo + octave * scaleLen;
  const hi = (UPPER_ROW as readonly string[]).indexOf(code);
  if (hi >= 0) return hi + (octave + 1) * scaleLen;
  return null;
}

/** degree → key letter, for the piano roll's labels (lower row wins where both reach). */
export function keyLabels(octave: number, scaleLen: number): Map<number, string> {
  const m = new Map<number, string>();
  UPPER_ROW.forEach((c, i) => m.set(i + (octave + 1) * scaleLen, LABEL(c)));
  LOWER_ROW.forEach((c, i) => m.set(i + octave * scaleLen, LABEL(c)));
  return m;
}

/** Drum tracks in order, for finger drumming in "Show all drums". */
export function drumTracks(tracks: Track[]): Track[] {
  return tracks.filter((t) => !usesNotes(t));
}

function typingInto(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.tagName !== 'INPUT') return false;
  // sliders, checkboxes and buttons don't take letters
  const type = (t as HTMLInputElement).type;
  return !['range', 'checkbox', 'radio', 'button', 'submit', 'color'].includes(type);
}

/** What a key press plays right now: a track and (for note tracks) a degree. */
export function keyTarget(code: string): { trackId: string; degree?: number } | null {
  const ui = useUiStore.getState();
  const { song } = useSongStore.getState();
  const track = song.tracks.find((t) => t.id === ui.selectedTrackId) ?? song.tracks[0];
  if (!track) return null;
  const octave = useKeysOctave.getState().octave;
  const len = scaleLength(song.key.scale);
  if (usesNotes(track)) {
    const d = keyDegree(code, octave, len);
    return d === null ? null : { trackId: track.id, degree: d };
  }
  if (keyDegree(code, 0, len) === null) return null;
  if (ui.drumView) {
    // finger drumming: A S D F… play each drum track in order
    const i = (LOWER_ROW as readonly string[]).indexOf(code);
    const t = i >= 0 ? drumTracks(song.tracks)[i] : undefined;
    return t ? { trackId: t.id } : null;
  }
  return { trackId: track.id };
}

/** Listen for note keys. Mount once. */
export function useKeyboardPiano() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const ui = useUiStore.getState();
      if (!ui.keysOn || ui.openModal || e.ctrlKey || e.metaKey || e.altKey || typingInto(e)) return;
      if (e.code === 'KeyZ' || e.code === 'KeyX') {
        if (!e.repeat) {
          const o = useKeysOctave.getState().octave + (e.code === 'KeyX' ? 1 : -1);
          useKeysOctave.setState({ octave: Math.max(MIN_OCTAVE, Math.min(MAX_OCTAVE, o)) });
        }
        e.preventDefault();
        return;
      }
      const target = keyTarget(e.code);
      if (!target) return;
      e.preventDefault();
      if (e.repeat) return;
      liveNoteOn(`key:${e.code}`, target.trackId, target.degree, KEYS_VELOCITY);
    };
    const up = (e: KeyboardEvent) => liveNoteOff(`key:${e.code}`);
    const lost = () => liveAllOff();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', lost);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', lost);
    };
  }, []);
}
