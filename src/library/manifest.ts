import { registerSoundNames } from './soundNames';

export interface LibraryKit {
  id: string;
  name: string;
  description: string;
}

export interface LibrarySample {
  id: string;
  kit: string;
  category: string;
  name: string;
  file: string;
  durationMs: number;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-3.0' | 'CC-BY-4.0';
  licenseUrl: string;
  sourceUrl: string;
  via?: string;
  rootNote?: number;
  templateRole?: string;
}

export interface LibraryManifest {
  version: 1;
  kits: LibraryKit[];
  samples: LibrarySample[];
}

export const CATEGORIES = [
  'Kicks',
  'Snares',
  'Hi-hats',
  'Claps & snaps',
  'Cymbals',
  'Percussion',
  'FX & risers',
  'Melodic one-shots',
  'Guitars',
  'Strings',
  'Vocal chops',
] as const;

export const samplesBase = () => `${import.meta.env.BASE_URL ?? './'}samples/`;

let manifest: LibraryManifest | null = null;
let pending: Promise<LibraryManifest> | null = null;

export function licenseLabel(l: string): string {
  if (l === 'CC0-1.0') return 'CC0';
  return l.replace(/^CC-BY-/, 'CC BY ');
}

export function setManifest(m: LibraryManifest) {
  manifest = m;
  const kits = new Map(m.kits.map((k) => [k.id, k.name]));
  const byId = new Map(m.samples.map((s) => [s.id, s]));
  registerSoundNames('lib', (id) => {
    const s = byId.get(id);
    return s
      ? { name: s.name, detail: `${kits.get(s.kit) ?? s.kit} · ${licenseLabel(s.license)}` }
      : undefined;
  });
}

export function loadManifest(): Promise<LibraryManifest> {
  if (manifest) return Promise.resolve(manifest);
  pending ??= fetch(`${samplesBase()}manifest.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Couldn't load the sound library (${r.status})`);
      return r.json() as Promise<LibraryManifest>;
    })
    .then((m) => {
      setManifest(m);
      return m;
    })
    .catch((e) => {
      pending = null;
      throw e;
    });
  return pending;
}

export function getManifest(): LibraryManifest | null {
  return manifest;
}

export function findSample(id: string): LibrarySample | undefined {
  return manifest?.samples.find((s) => s.id === id);
}

export function findByRole(role: string): LibrarySample | undefined {
  return manifest?.samples.find((s) => s.templateRole === role);
}

export function searchSamples(
  m: LibraryManifest,
  query: string,
  category?: string,
): LibrarySample[] {
  const q = query.trim().toLowerCase();
  const kits = new Map(m.kits.map((k) => [k.id, k.name.toLowerCase()]));
  return m.samples.filter((s) => {
    if (category && s.category !== category && !q) return false;
    if (!q) return true;
    const hay = `${s.name} ${kits.get(s.kit) ?? ''} ${s.category}`.toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}
