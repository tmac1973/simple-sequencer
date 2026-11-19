import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Song } from '@/model/types';

export interface StoredSample {
  id: string;
  name: string;
  mime: string;
  bytes: Blob;
  /** SHA-256 hex of the bytes */
  hash: string;
  durationMs: number;
  createdAt: number;
}

export interface StoredSong {
  id: string;
  name: string;
  updatedAt: number;
  bpm: number;
  trackCount: number;
  song: Song;
  deletedAt?: number;
}

interface SeqDB extends DBSchema {
  samples: { key: string; value: StoredSample; indexes: { hash: string } };
  songs: { key: string; value: StoredSong; indexes: { updatedAt: number } };
}

export class StorageQuotaError extends Error {
  constructor() {
    super('Your browser storage is full. Delete some sounds or songs to make room.');
    this.name = 'StorageQuotaError';
  }
}

export const DB_NAME = 'simple-sequencer';
let dbp: Promise<IDBPDatabase<SeqDB>> | null = null;

export function db(): Promise<IDBPDatabase<SeqDB>> {
  dbp ??= openDB<SeqDB>(DB_NAME, 1, {
    upgrade(d) {
      const s = d.createObjectStore('samples', { keyPath: 'id' });
      s.createIndex('hash', 'hash');
      const g = d.createObjectStore('songs', { keyPath: 'id' });
      g.createIndex('updatedAt', 'updatedAt');
    },
  });
  return dbp;
}

/** Test helper: close and forget the cached connection. */
export async function resetDbForTests() {
  if (dbp) (await dbp).close();
  dbp = null;
}

/** Convert browser quota errors into StorageQuotaError. */
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'QuotaExceededError' || (e as Error)?.message?.includes('quota'))
      throw new StorageQuotaError();
    throw e;
  }
}

export async function sha256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
