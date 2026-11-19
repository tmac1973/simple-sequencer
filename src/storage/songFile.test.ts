import { freshDb } from './testDb';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { exportSongFile, importSongFile } from './songFile';
import { addUserSample, listUserSamples } from './userSamples';
import { createSampleTrack, createSong, createSynthTrack } from '@/model/factories';

const asFile = async (b: Blob, name: string) => new File([await b.arrayBuffer()], name);

describe('song files', () => {
  beforeEach(freshDb);

  it('round-trips a .json song with a new id', async () => {
    const song = createSong({
      name: 'Groove',
      tracks: [createSampleTrack({ sampleId: 'lib:dusty-kick' }), createSynthTrack()],
    });
    const { blob, filename } = await exportSongFile(song);
    expect(filename).toBe('Groove.json');
    const back = await importSongFile(await asFile(blob, filename));
    expect(back.id).not.toBe(song.id);
    expect({ ...back, id: song.id, updatedAt: song.updatedAt }).toEqual(song);
  });

  it('bundles custom sounds in a .zip and restores them', async () => {
    const s1 = await addUserSample(
      'Snap',
      new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' }),
      { durationMs: 1 },
    );
    const s2 = await addUserSample(
      'Vox',
      new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/mpeg' }),
      { durationMs: 1 },
    );
    const song = createSong({
      name: 'Mine',
      tracks: [createSampleTrack({ sampleId: s1.id }), createSampleTrack({ sampleId: s2.id })],
    });
    const { blob, filename } = await exportSongFile(song);
    expect(filename).toBe('Mine.zip');
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const names = Object.keys(files);
    expect(names).toContain('song.json');
    expect(names).toContain('samples/index.json');
    expect(names.filter((n) => n.endsWith('.wav'))).toHaveLength(1);
    expect(names.filter((n) => n.endsWith('.mp3'))).toHaveLength(1);

    await freshDb(); // another browser: My Sounds is empty
    const back = await importSongFile(await asFile(blob, filename));
    const mine = await listUserSamples();
    expect(mine.map((s) => s.name).sort()).toEqual(['Snap', 'Vox']);
    expect(
      back.tracks.map((t) => t.sample!.sampleId).every((id) => mine.some((s) => s.id === id)),
    ).toBe(true);
    // importing again reuses the same sounds (content hash)
    await importSongFile(await asFile(blob, filename));
    expect(await listUserSamples()).toHaveLength(2);
  });

  it('rejects bad files with readable messages', async () => {
    await expect(importSongFile(new File(['not json'], 'x.json'))).rejects.toThrow(
      /isn't a song file/,
    );
    await expect(
      importSongFile(new File([JSON.stringify({ format: 'nope' })], 'x.json')),
    ).rejects.toThrow(/isn't a Simple Sequencer song/);
    await expect(
      importSongFile(new File([JSON.stringify({ ...createSong(), version: 7 })], 'x.json')),
    ).rejects.toThrow(/newer version/);
    const zip = zipSync({ 'readme.txt': strToU8('hi') });
    await expect(importSongFile(new File([zip as BlobPart], 'x.zip'))).rejects.toThrow(
      /no song.json/,
    );
    await expect(importSongFile(new File(['PK junk'], 'x.zip'))).rejects.toThrow(
      /couldn't be opened/,
    );
  });
});
