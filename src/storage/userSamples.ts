import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { registerSoundNames } from '@/library/soundNames';
import { SampleRegistry } from '@/audio/sampleRegistry';
import { decodeAudio } from '@/audio/decode';
import type { Song } from '@/model/types';
import { db, guard, sha256, type StoredSample } from './db';

export interface UserSoundMeta {
  id: string;
  name: string;
  durationMs: number;
  createdAt: number;
  mime: string;
}

interface UserSoundsState {
  sounds: UserSoundMeta[];
  loaded: boolean;
  refresh(): Promise<void>;
}

const toMeta = (s: StoredSample): UserSoundMeta => ({
  id: s.id,
  name: s.name,
  durationMs: s.durationMs,
  createdAt: s.createdAt,
  mime: s.mime,
});

export const useUserSoundsStore = create<UserSoundsState>((set) => ({
  sounds: [],
  loaded: false,
  async refresh() {
    const all = await (await db()).getAll('samples');
    all.sort((a, b) => b.createdAt - a.createdAt);
    set({ sounds: all.map(toMeta), loaded: true });
    registerUserNames();
  },
}));

function registerUserNames() {
  const map = new Map(useUserSoundsStore.getState().sounds.map((s) => [s.id, s]));
  registerSoundNames('user', (id) => {
    const s = map.get(id);
    return s
      ? { name: s.name, detail: 'My Sounds' }
      : { name: 'Missing sound', detail: 'This custom sound is not in this browser' };
  });
}

export async function findUserSampleByHash(hash: string): Promise<StoredSample | undefined> {
  return (await db()).getFromIndex('samples', 'hash', hash);
}

/** Store a sound in My Sounds. Re-adding identical bytes returns the existing sound. */
export async function addUserSample(
  name: string,
  blob: Blob,
  opts: { durationMs?: number; id?: string } = {},
): Promise<UserSoundMeta> {
  const hash = await sha256(blob);
  const existing = await findUserSampleByHash(hash);
  if (existing) return toMeta(existing);
  let durationMs = opts.durationMs;
  if (durationMs === undefined) {
    const buf = await decodeAudio(await blob.arrayBuffer());
    durationMs = Math.round(buf.duration * 1000);
  }
  const rec: StoredSample = {
    id: opts.id ?? `user:${nanoid(10)}`,
    name: name.trim().slice(0, 60) || 'My sound',
    mime: blob.type || 'application/octet-stream',
    bytes: blob,
    hash,
    durationMs,
    createdAt: Date.now(),
  };
  await guard(async () => (await db()).put('samples', rec));
  await useUserSoundsStore.getState().refresh();
  return toMeta(rec);
}

export async function listUserSamples(): Promise<UserSoundMeta[]> {
  await useUserSoundsStore.getState().refresh();
  return useUserSoundsStore.getState().sounds;
}

export async function getUserSampleBlob(id: string): Promise<StoredSample | undefined> {
  return (await db()).get('samples', id);
}

export async function renameUserSample(id: string, name: string) {
  const d = await db();
  const s = await d.get('samples', id);
  if (!s || !name.trim()) return;
  s.name = name.trim().slice(0, 60);
  await guard(() => d.put('samples', s));
  await useUserSoundsStore.getState().refresh();
}

export class SampleInUseError extends Error {
  constructor(public readonly users: string[]) {
    super(`Used by: ${users.join(', ')}`);
    this.name = 'SampleInUseError';
  }
}

/** Where a sample is used, as human-readable names. Phase-11 storage adds other saved songs. */
export type UsageFinder = (id: string) => Promise<string[]>;
let extraUsage: UsageFinder | null = null;
export function setUsageFinder(f: UsageFinder) {
  extraUsage = f;
}

export function tracksUsing(song: Song, id: string): string[] {
  return song.tracks.filter((t) => t.sample?.sampleId === id).map((t) => t.name);
}

export async function deleteUserSample(id: string, current: Song) {
  const users = tracksUsing(current, id).map((n) => `${n} (this song)`);
  if (extraUsage) users.push(...(await extraUsage(id)));
  if (users.length) throw new SampleInUseError(users);
  await (await db()).delete('samples', id);
  SampleRegistry.forget(id);
  await useUserSoundsStore.getState().refresh();
}

export function registerUserResolver() {
  SampleRegistry.addResolver('user', async (id) => {
    const s = await getUserSampleBlob(id);
    if (!s) throw new Error('This custom sound is not in this browser.');
    return decodeAudio(await s.bytes.arrayBuffer());
  });
  registerUserNames();
}
