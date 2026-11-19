import { create } from 'zustand';
import type { Song } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { StorageQuotaError } from './db';
import { saveSong } from './songs';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const useSaveStatus = create<{ status: SaveStatus; error: string | null }>(() => ({
  status: 'idle',
  error: null,
}));

export const LAST_SONG_KEY = 'ss:lastSongId';
export const AUTOSAVE_DELAY = 1500;

export function rememberLastSong(id: string) {
  try {
    localStorage.setItem(LAST_SONG_KEY, id);
  } catch {
    /* storage blocked: fine */
  }
}

export function lastSongId(): string | null {
  try {
    return localStorage.getItem(LAST_SONG_KEY);
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let pending: Song | null = null;
let lastSaved: Song | null = null;

async function flushNow() {
  clearTimeout(timer);
  const song = pending;
  pending = null;
  if (!song || song === lastSaved) return;
  useSaveStatus.setState({ status: 'saving' });
  try {
    await saveSong(song);
    lastSaved = song;
    rememberLastSong(song.id);
    useSaveStatus.setState({ status: pending ? 'saving' : 'saved', error: null });
  } catch (e) {
    pending = pending ?? song;
    useSaveStatus.setState({
      status: 'error',
      error: e instanceof StorageQuotaError ? e.message : "Couldn't save to this browser.",
    });
  }
}

export function flushAutosave(): Promise<void> {
  return flushNow();
}

/** Mark a song as already saved (e.g. just loaded from the library). */
export function markSaved(song: Song) {
  lastSaved = song;
  rememberLastSong(song.id);
  useSaveStatus.setState({ status: 'saved', error: null });
}

/** Save the song 1.5 s after the last change, and right away when the page is hidden. */
export function startAutosave(delay = AUTOSAVE_DELAY): () => void {
  const schedule = (song: Song) => {
    pending = song;
    if (useSaveStatus.getState().status !== 'error') useSaveStatus.setState({ status: 'saving' });
    clearTimeout(timer);
    timer = setTimeout(() => void flushNow(), delay);
  };
  const unsub = useSongStore.subscribe((s, prev) => {
    if (s.song !== prev.song) schedule(s.song);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flushNow();
  };
  const onPageHide = () => void flushNow();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);
  return () => {
    unsub();
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onPageHide);
  };
}
