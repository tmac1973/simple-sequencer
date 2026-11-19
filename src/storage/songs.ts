import { newId } from '@/model/factories';
import { migrateSong, validateSong } from '@/model/schema';
import type { Song } from '@/model/types';
import { db, guard, type StoredSong } from './db';

export interface SongSummary {
  id: string;
  name: string;
  updatedAt: number;
  bpm: number;
  trackCount: number;
}

export const TRASH_DAYS = 30;

const summary = (s: StoredSong): SongSummary => ({
  id: s.id,
  name: s.name,
  updatedAt: s.updatedAt,
  bpm: s.bpm,
  trackCount: s.trackCount,
});

/** Insert or update a song in the library. */
export async function saveSong(song: Song, now = Date.now()): Promise<void> {
  const stored: StoredSong = {
    id: song.id,
    name: song.name,
    updatedAt: now,
    bpm: song.bpm,
    trackCount: song.tracks.length,
    song: { ...song, updatedAt: now },
  };
  await guard(async () => (await db()).put('songs', stored));
}

export async function listSongs(): Promise<SongSummary[]> {
  const all = await (await db()).getAll('songs');
  return all
    .filter((s) => s.deletedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(summary);
}

/** Load and validate a stored song (null if missing or deleted). */
export async function loadSongById(id: string): Promise<Song | null> {
  const s = await (await db()).get('songs', id);
  if (!s || s.deletedAt !== undefined) return null;
  return validateSong(migrateSong(s.song));
}

export async function renameSong(id: string, name: string): Promise<void> {
  const d = await db();
  const s = await d.get('songs', id);
  if (!s || !name.trim()) return;
  s.name = name.trim().slice(0, 80);
  s.song = { ...s.song, name: s.name };
  await guard(() => d.put('songs', s));
}

export async function duplicateSong(id: string): Promise<string | null> {
  const song = await loadSongById(id);
  if (!song) return null;
  const copy: Song = {
    ...structuredClone(song),
    id: newId(),
    name: `${song.name} copy`.slice(0, 80),
    createdAt: Date.now(),
  };
  await saveSong(copy);
  return copy.id;
}

/** Move to trash (kept for 30 days, so it can be undone). */
export async function deleteSong(id: string, now = Date.now()): Promise<void> {
  const d = await db();
  const s = await d.get('songs', id);
  if (!s) return;
  s.deletedAt = now;
  await guard(() => d.put('songs', s));
}

export async function undeleteSong(id: string): Promise<void> {
  const d = await db();
  const s = await d.get('songs', id);
  if (!s) return;
  delete s.deletedAt;
  await guard(() => d.put('songs', s));
}

/** Permanently remove songs deleted more than 30 days ago. */
export async function purgeTrash(now = Date.now()): Promise<number> {
  const d = await db();
  const all = await d.getAll('songs');
  const old = all.filter(
    (s) => s.deletedAt !== undefined && now - s.deletedAt > TRASH_DAYS * 86_400_000,
  );
  for (const s of old) await d.delete('songs', s.id);
  return old.length;
}

/** Names of saved songs (other than `exceptId`) that use a sample. */
export async function songsUsingSample(sampleId: string, exceptId?: string): Promise<string[]> {
  const all = await (await db()).getAll('songs');
  return all
    .filter(
      (s) =>
        s.deletedAt === undefined &&
        s.id !== exceptId &&
        s.song.tracks.some((t) => t.sample?.sampleId === sampleId),
    )
    .map((s) => s.name);
}
