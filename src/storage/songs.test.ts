import { freshDb } from './testDb';
import {
  saveSong,
  listSongs,
  loadSongById,
  renameSong,
  duplicateSong,
  deleteSong,
  undeleteSong,
  purgeTrash,
  songsUsingSample,
} from './songs';
import { createSampleTrack, createSong } from '@/model/factories';

describe('song library', () => {
  beforeEach(freshDb);

  it('saves, lists newest first and loads', async () => {
    const a = createSong({ name: 'A' });
    const b = createSong({ name: 'B', tracks: [createSampleTrack()] });
    await saveSong(a, 1000);
    await saveSong(b, 2000);
    expect((await listSongs()).map((s) => [s.name, s.trackCount])).toEqual([
      ['B', 1],
      ['A', 0],
    ]);
    expect((await loadSongById(a.id))?.name).toBe('A');
  });

  it('renames and duplicates with a new id', async () => {
    const a = createSong({ name: 'A' });
    await saveSong(a);
    await renameSong(a.id, 'Alpha');
    const copyId = (await duplicateSong(a.id))!;
    expect(copyId).not.toBe(a.id);
    const names = (await listSongs()).map((s) => s.name).sort();
    expect(names).toEqual(['Alpha', 'Alpha copy']);
    expect((await loadSongById(a.id))?.name).toBe('Alpha');
  });

  it('delete moves to trash, undo restores, purge removes after 30 days', async () => {
    const a = createSong({ name: 'A' });
    await saveSong(a);
    await deleteSong(a.id, 0);
    expect(await listSongs()).toEqual([]);
    expect(await loadSongById(a.id)).toBeNull();
    await undeleteSong(a.id);
    expect(await listSongs()).toHaveLength(1);
    await deleteSong(a.id, 0);
    expect(await purgeTrash(10 * 86_400_000)).toBe(0);
    expect(await purgeTrash(31 * 86_400_000)).toBe(1);
  });

  it('finds other songs that use a custom sound', async () => {
    const a = createSong({ name: 'Uses it', tracks: [createSampleTrack({ sampleId: 'user:x' })] });
    await saveSong(a);
    await saveSong(createSong({ name: 'Does not' }));
    expect(await songsUsingSample('user:x')).toEqual(['Uses it']);
    expect(await songsUsingSample('user:x', a.id)).toEqual([]);
  });
});
