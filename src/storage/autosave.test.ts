import { freshDb } from './testDb';
import { startAutosave, useSaveStatus, flushAutosave, lastSongId } from './autosave';
import { listSongs } from './songs';
import { useSongStore } from '@/store/songStore';
import { createSong } from '@/model/factories';

describe('autosave', () => {
  beforeEach(freshDb);

  it('debounces changes and saves once', async () => {
    useSongStore.getState().loadSong(createSong({ name: 'Start' }));
    const stop = startAutosave(50);
    useSongStore.getState().setName('One');
    useSongStore.getState().setName('Two');
    expect(useSaveStatus.getState().status).toBe('saving');
    await new Promise((r) => setTimeout(r, 120));
    await flushAutosave();
    const songs = await listSongs();
    expect(songs.map((s) => s.name)).toEqual(['Two']);
    expect(useSaveStatus.getState().status).toBe('saved');
    expect(lastSongId()).toBe(useSongStore.getState().song.id);
    stop();
  });

  it('flushes immediately when the page is hidden', async () => {
    useSongStore.getState().loadSong(createSong({ name: 'X' }));
    const stop = startAutosave(10_000);
    useSongStore.getState().setName('Hidden');
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 50));
    expect((await listSongs()).map((s) => s.name)).toEqual(['Hidden']);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    stop();
  });
});
