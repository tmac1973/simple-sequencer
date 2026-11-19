import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { newId } from '@/model/factories';
import { migrateSong, SongFormatError, validateSong } from '@/model/schema';
import type { Song } from '@/model/types';
import { bytesOf, sha256 } from './db';
import { addUserSample, findUserSampleByHash, getUserSampleBlob } from './userSamples';

const EXT: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/webm': 'webm',
};

export function safeFileName(name: string): string {
  return (name.trim() || 'song')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

/** Song → .json, or .zip (song.json + samples/) when it uses sounds from My Sounds. */
export async function exportSongFile(song: Song): Promise<{ blob: Blob; filename: string }> {
  const userIds = [
    ...new Set(
      song.tracks
        .map((t) => t.sample?.sampleId)
        .filter((x): x is string => !!x?.startsWith('user:')),
    ),
  ];
  const json = JSON.stringify(song, null, 2);
  const base = safeFileName(song.name);
  if (!userIds.length)
    return { blob: new Blob([json], { type: 'application/json' }), filename: `${base}.json` };
  const files: Record<string, Uint8Array> = { 'song.json': strToU8(json) };
  const index: { id: string; name: string; mime: string; file: string }[] = [];
  for (const id of userIds) {
    const s = await getUserSampleBlob(id);
    if (!s) continue;
    const file = `samples/${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.${EXT[s.mime] ?? 'bin'}`;
    files[file] = new Uint8Array(await bytesOf(s));
    index.push({ id, name: s.name, mime: s.mime, file });
  }
  files['samples/index.json'] = strToU8(JSON.stringify(index, null, 2));
  const zip = zipSync(files, { level: 0 });
  return {
    blob: new Blob([zip as BlobPart], { type: 'application/zip' }),
    filename: `${base}.zip`,
  };
}

function parseSong(text: string): Song {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SongFormatError("This file isn't a song file (it couldn't be read).");
  }
  return validateSong(migrateSong(raw));
}

/**
 * .json / .zip → Song with a NEW id (importing never overwrites a saved song). Sounds in a zip
 * are added to My Sounds; identical sounds already there are reused.
 */
export async function importSongFile(
  file: File | Blob,
  name = (file as File).name ?? 'song.json',
): Promise<Song> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let song: Song;
  if (!isZip) {
    if (!/\.json$/i.test(name) && bytes[0] !== 0x7b)
      throw new SongFormatError('Choose a .json or .zip song file.');
    song = parseSong(strFromU8(bytes));
  } else {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new SongFormatError("This zip file couldn't be opened.");
    }
    const songJson = entries['song.json'];
    if (!songJson) throw new SongFormatError('This zip has no song.json inside.');
    song = parseSong(strFromU8(songJson));
    const indexRaw = entries['samples/index.json'];
    const index: { id: string; name: string; mime: string; file: string }[] = indexRaw
      ? JSON.parse(strFromU8(indexRaw))
      : [];
    const remap = new Map<string, string>();
    for (const s of index) {
      const data = entries[s.file];
      if (!data) continue;
      const blob = new Blob([data as BlobPart], { type: s.mime });
      const existing = await findUserSampleByHash(await sha256(data.slice().buffer));
      const stored = existing ? { id: existing.id } : await addUserSample(s.name, blob);
      remap.set(s.id, stored.id);
    }
    for (const t of song.tracks)
      if (t.sample && remap.has(t.sample.sampleId))
        t.sample.sampleId = remap.get(t.sample.sampleId)!;
  }
  return { ...song, id: newId(), updatedAt: Date.now() };
}

/** Trigger a browser download of a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
