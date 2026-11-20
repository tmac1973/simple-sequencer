import { create } from 'zustand';
import { degreeToMidi } from '@/model/scale';
import { usesNotes } from '@/audio/scheduler';
import { getPreset } from '@/audio/synthPresets';
import type { SongKey, Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { drumTracks } from './keyboardPiano';
import { liveAllOff, liveNoteOff, liveNoteOn, setSustain } from './livePlay';

/**
 * MIDI keyboard input (Web MIDI: Chrome, Edge, Firefox; not Safari). Off until the user
 * turns it on, which is when the browser asks for permission. Notes snap to the song's
 * scale, so every key sounds right.
 */

export type MidiStatus = 'unsupported' | 'off' | 'asking' | 'on' | 'denied';

export interface MidiDevice {
  id: string;
  name: string;
}

interface MidiState {
  status: MidiStatus;
  devices: MidiDevice[];
  /** 'all' or one input's id */
  deviceId: string;
}

const STORE_KEY = 'ss:midi';
/** The first note of "drum pads" (GM kick), for finger drumming on MIDI controllers. */
export const DRUM_BASE_NOTE = 36;

const supported = () => typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;

export const useMidi = create<MidiState>(() => ({
  status: supported() ? 'off' : 'unsupported',
  devices: [],
  deviceId: 'all',
}));

let access: MIDIAccess | null = null;

function remember(on: boolean) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ on, deviceId: useMidi.getState().deviceId }));
  } catch {
    /* storage blocked: it just won't be remembered */
  }
}

/** The scale degree nearest to a MIDI note (rounding down on ties), for this key. */
export function midiToDegree(midi: number, key: SongKey): number {
  let d = Math.round(((midi - 48) * 7) / 12) - 2;
  while (degreeToMidi(d + 1, key) <= midi) d++;
  while (degreeToMidi(d, key) > midi) d--;
  const below = midi - degreeToMidi(d, key);
  const above = degreeToMidi(d + 1, key) - midi;
  return Math.max(-64, Math.min(64, above < below ? d + 1 : d));
}

/** What a MIDI note plays right now: the selected track (in key), or a drum in "Show all drums". */
export function midiTarget(note: number): { trackId: string; degree?: number } | null {
  const ui = useUiStore.getState();
  const { song } = useSongStore.getState();
  const track: Track | undefined =
    song.tracks.find((t) => t.id === ui.selectedTrackId) ?? song.tracks[0];
  if (!track) return null;
  if (usesNotes(track)) {
    // synth presets that sound an octave down/up: the key you press is the pitch you hear
    const shift =
      track.kind === 'synth' ? getPreset(track.synth?.presetId ?? '').octaveShift * 12 : 0;
    return { trackId: track.id, degree: midiToDegree(note - shift, song.key) };
  }
  if (ui.drumView) {
    const t = drumTracks(song.tracks)[note - DRUM_BASE_NOTE];
    return t ? { trackId: t.id } : null;
  }
  return { trackId: track.id };
}

/** Handle one MIDI message from `deviceId`. Exported for tests. */
export function handleMidiMessage(deviceId: string, data: ArrayLike<number>) {
  const sel = useMidi.getState().deviceId;
  if (sel !== 'all' && sel !== deviceId) return;
  const [status = 0, a = 0, b = 0] = Array.from(data);
  const kind = status & 0xf0;
  const source = `midi:${deviceId}:${a}`;
  if (kind === 0x90 && b > 0) {
    if (useUiStore.getState().openModal) return;
    const target = midiTarget(a);
    if (target) liveNoteOn(source, target.trackId, target.degree, Math.max(0.1, b / 127));
  } else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
    liveNoteOff(source);
  } else if (kind === 0xb0 && a === 64) {
    setSustain(b >= 64);
  }
}

function refresh() {
  if (!access) return;
  const devices: MidiDevice[] = [];
  access.inputs.forEach((input) => {
    devices.push({ id: input.id, name: input.name || 'MIDI keyboard' });
    input.onmidimessage = (e) => e.data && handleMidiMessage(input.id, e.data);
  });
  useMidi.setState({ devices });
}

/** Turn MIDI on (asks the browser for permission the first time). */
export async function enableMidi(): Promise<void> {
  if (!supported()) return;
  useMidi.setState({ status: 'asking' });
  try {
    access = await navigator.requestMIDIAccess();
    access.onstatechange = refresh;
    refresh();
    useMidi.setState({ status: 'on' });
    remember(true);
  } catch {
    access = null;
    useMidi.setState({ status: 'denied', devices: [] });
  }
}

export function disableMidi() {
  access?.inputs.forEach((input) => (input.onmidimessage = null));
  if (access) access.onstatechange = null;
  access = null;
  liveAllOff();
  useMidi.setState({ status: supported() ? 'off' : 'unsupported', devices: [] });
  remember(false);
}

export function setMidiDevice(deviceId: string) {
  useMidi.setState({ deviceId });
  remember(useMidi.getState().status === 'on');
}

/**
 * At startup: if MIDI was on last time and the browser already allows it, turn it back on
 * without asking. Otherwise wait for the user to click.
 */
export async function restoreMidi() {
  if (!supported()) return;
  let saved: { on?: boolean; deviceId?: string };
  try {
    saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    return;
  }
  if (saved.deviceId) useMidi.setState({ deviceId: saved.deviceId });
  if (!saved.on) return;
  try {
    const p = await navigator.permissions?.query({ name: 'midi' as PermissionName });
    if (p?.state === 'granted') await enableMidi();
  } catch {
    /* can't tell without asking: leave it off until clicked */
  }
}
