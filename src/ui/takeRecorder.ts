import { create } from 'zustand';
import { engine } from '@/audio/engine';
import { getLoopRegion, usesNotes } from '@/audio/scheduler';
import { playContextOf } from '@/audio/useEngineSync';
import { newId } from '@/model/factories';
import { BEATS_PER_BAR } from '@/model/timing';
import type { Pattern } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { onLiveNote, type LiveNote } from './livePlay';
import { toastError } from './toast';

/**
 * ● Rec: count in, loop the selected pattern with a click, and add what's played
 * (computer keyboard or MIDI) to it. Each pass adds; nothing is erased. One take = one undo.
 */

/** Snap recorded notes to: the pattern's steps, 1/8 notes, or whole beats. */
export type RecSnap = 'step' | 'eighth' | 'beat';

export interface RecSettings {
  snap: RecSnap;
  /** bars of count-in clicks (0 or 1) */
  countIn: 0 | 1;
  /** metronome click volume, 0–1 */
  clickVolume: number;
}

const SETTINGS_KEY = 'ss:rec';
const DEFAULTS: RecSettings = { snap: 'step', countIn: 1, clickVolume: 0.6 };

function loadSettings(): RecSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export const useRecSettings = create<RecSettings>(() => loadSettings());

export function setRecSettings(patch: Partial<RecSettings>) {
  useRecSettings.setState(patch);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(useRecSettings.getState()));
  } catch {
    /* not remembered */
  }
}

export interface RecState {
  recording: boolean;
  trackId: string | null;
  patternId: string | null;
  /** notes/hits added in this take */
  added: number;
}

export const useRec = create<RecState>(() => ({
  recording: false,
  trackId: null,
  patternId: null,
  added: 0,
}));

/** Steps per snap unit for this pattern. */
function snapSteps(p: Pattern, snap: RecSnap): number {
  if (snap === 'beat') return p.stepsPerBar / BEATS_PER_BAR;
  if (snap === 'eighth') return p.stepsPerBar / (BEATS_PER_BAR * 2);
  return 1;
}

/**
 * Turn a played note into a step position in the looping pattern (pure; exported for tests).
 * `loopStartBeat` is where the pattern's loop starts in the song.
 */
export function placeNote(
  n: Pick<LiveNote, 'startBeat' | 'endBeat'>,
  p: Pattern,
  loopStartBeat: number,
  snap: RecSnap,
): { start: number; length: number } | null {
  if (n.startBeat === null) return null;
  const total = p.lengthBars * p.stepsPerBar;
  const loopBeats = p.lengthBars * BEATS_PER_BAR;
  const perBeat = p.stepsPerBar / BEATS_PER_BAR;
  const unit = snapSteps(p, snap);
  const rel = (((n.startBeat - loopStartBeat) % loopBeats) + loopBeats) % loopBeats;
  const start = (Math.round((rel * perBeat) / unit) * unit) % total;
  let lenBeats = n.endBeat === null ? 0 : n.endBeat - n.startBeat;
  if (lenBeats < 0) lenBeats += loopBeats; // released after the loop wrapped
  const length = Math.max(1, Math.min(total - start, Math.round(lenBeats * perBeat)));
  return { start, length };
}

let unsubNote: (() => void) | null = null;
let unsubPlay: (() => void) | null = null;
let gesture = '';

function onNote(n: LiveNote, phase: 'on' | 'off') {
  const rec = useRec.getState();
  if (!rec.recording || phase !== 'off' || n.trackId !== rec.trackId) return;
  const { song } = useSongStore.getState();
  const track = song.tracks.find((t) => t.id === rec.trackId);
  const p = track?.patterns.find((x) => x.id === rec.patternId);
  if (!track || !p) return;
  const region = getLoopRegion(
    song,
    playContextOf({ ...useUiStore.getState(), playMode: 'pattern' }),
  );
  const placed = placeNote(n, p, region.startBar * BEATS_PER_BAR, useRecSettings.getState().snap);
  if (!placed) return;
  const a = useSongStore.getState();
  if (usesNotes(track) && n.degree !== undefined)
    a.recordHits(
      track.id,
      p.id,
      { notes: [{ ...placed, degree: n.degree, velocity: n.velocity }] },
      gesture,
    );
  else
    a.recordHits(
      track.id,
      p.id,
      { steps: [{ index: placed.start, velocity: n.velocity }] },
      gesture,
    );
  useRec.setState({ added: rec.added + 1 });
}

/** Start recording into the selected track's selected pattern. */
export async function startRecording(trackId: string, patternId: string) {
  stopRecording();
  const ui = useUiStore.getState();
  if (ui.playing) engine.stop();
  ui.setPlayMode('pattern');
  ui.selectTrack(trackId);
  ui.selectPattern(trackId, patternId);
  gesture = `rec-${newId()}`;
  useRec.setState({ recording: true, trackId, patternId, added: 0 });
  unsubNote = onLiveNote(onNote);
  ui.setPlaying(true);
  const s = useRecSettings.getState();
  try {
    await engine.play(0, {
      countInBeats: s.countIn * BEATS_PER_BAR,
      click: { volume: s.clickVolume },
    });
  } catch (e) {
    stopRecording();
    toastError(e);
    return;
  }
  // Space or ■ stops playback: that ends the take too
  unsubPlay = useUiStore.subscribe((u, prev) => {
    if (prev.playing && !u.playing) stopRecording();
  });
}

export function stopRecording() {
  unsubNote?.();
  unsubPlay?.();
  unsubNote = unsubPlay = null;
  if (!useRec.getState().recording) return;
  useRec.setState({ recording: false });
  if (useUiStore.getState().playing) {
    engine.stop();
    useUiStore.getState().setPlaying(false);
  }
}
