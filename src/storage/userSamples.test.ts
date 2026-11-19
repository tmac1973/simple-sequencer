import 'fake-indexeddb/auto';
import {
  addUserSample,
  deleteUserSample,
  listUserSamples,
  renameUserSample,
  SampleInUseError,
  getUserSampleBlob,
} from './userSamples';
import { createSampleTrack, createSong } from '@/model/factories';
import { resetDbForTests } from './db';

const blob = (n: number) => new Blob([new Uint8Array([1, 2, 3, n])], { type: 'audio/wav' });

describe('My Sounds storage', () => {
  beforeEach(async () => {
    await resetDbForTests();
    await new Promise<void>((res) => {
      const r = indexedDB.deleteDatabase('simple-sequencer');
      r.onsuccess = () => res();
      r.onerror = () => res();
    });
  });

  it('adds, lists newest first, renames', async () => {
    const a = await addUserSample('Clap', blob(1), { durationMs: 100 });
    await new Promise((r) => setTimeout(r, 5));
    await addUserSample('Snap', blob(2), { durationMs: 200 });
    expect((await listUserSamples()).map((s) => s.name)).toEqual(['Snap', 'Clap']);
    await renameUserSample(a.id, 'Big Clap');
    expect((await listUserSamples()).find((s) => s.id === a.id)?.name).toBe('Big Clap');
    expect((await getUserSampleBlob(a.id))?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('dedupes identical bytes', async () => {
    const a = await addUserSample('One', blob(7), { durationMs: 1 });
    const b = await addUserSample('Two', blob(7), { durationMs: 1 });
    expect(b.id).toBe(a.id);
    expect(await listUserSamples()).toHaveLength(1);
  });

  it('refuses to delete a sound the song uses', async () => {
    const s = await addUserSample('Kick', blob(3), { durationMs: 1 });
    const song = createSong({ tracks: [createSampleTrack({ name: 'My Kick', sampleId: s.id })] });
    await expect(deleteUserSample(s.id, song)).rejects.toThrow(SampleInUseError);
    await expect(deleteUserSample(s.id, song)).rejects.toThrow(/My Kick/);
    await deleteUserSample(s.id, createSong());
    expect(await listUserSamples()).toHaveLength(0);
  });
});
