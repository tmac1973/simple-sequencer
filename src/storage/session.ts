import { SampleRegistry } from '@/audio/sampleRegistry';
import { engine } from '@/audio/engine';
import type { Song } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { flushAutosave, lastSongId, markSaved, startAutosave } from './autosave';
import { loadSongById, purgeTrash, songsUsingSample } from './songs';
import { setUsageFinder } from './userSamples';

/** Make `song` the current song. `saved` = it came from the library (no need to re-save). */
export async function openSong(song: Song, { saved = false } = {}) {
  await flushAutosave();
  engine.stop();
  const ui = useUiStore.getState();
  ui.setPlaying(false);
  useSongStore.getState().loadSong(song);
  if (saved) markSaved(useSongStore.getState().song);
  for (const t of song.tracks) if (t.sample) SampleRegistry.warm(t.sample.sampleId);
  ui.selectTrack(song.tracks[0]?.id ?? null);
  ui.setSongStartBar(0);
}

/**
 * Start autosaving and restore the last song. If there is none (first run), the song already in
 * the store (the Lo-fi template) stays and gets saved like any other.
 * Returns true when a saved song was restored.
 */
export async function startPersistence(): Promise<boolean> {
  setUsageFinder((id) =>
    songsUsingSample(id, useSongStore.getState().song.id).then((names) =>
      names.map((n) => `${n} (saved song)`),
    ),
  );
  startAutosave();
  purgeTrash().catch(() => {});
  const id = lastSongId();
  if (id) {
    try {
      const song = await loadSongById(id);
      if (song) {
        await openSong(song, { saved: true });
        return true;
      }
    } catch (e) {
      console.warn('[storage] could not restore last song', e);
    }
  }
  // first run: save the starting song so it's in the library
  const cur = useSongStore.getState().song;
  useSongStore.setState({ song: { ...cur } });
  return false;
}
