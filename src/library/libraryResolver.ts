import { SampleRegistry } from '@/audio/sampleRegistry';
import { decodeAudio } from '@/audio/decode';
import { loadManifest, samplesBase } from './manifest';

/** "lib:<id>" → fetch public/samples/<kit>/<id>.flac and decode. */
export function registerLibraryResolver() {
  SampleRegistry.addResolver('lib', async (id) => {
    const m = await loadManifest();
    const s = m.samples.find((x) => x.id === id);
    if (!s) throw new Error(`Sound not found in the library: ${id}`);
    const res = await fetch(`${samplesBase()}${s.file}`);
    if (!res.ok) throw new Error(`Couldn't load ${s.name} (${res.status})`);
    return decodeAudio(await res.arrayBuffer());
  });
}

/** Load every sound of one kit in parallel (e.g. when a song using it opens). */
export async function preloadKit(kitId: string) {
  const m = await loadManifest();
  await Promise.allSettled(
    m.samples.filter((s) => s.kit === kitId).map((s) => SampleRegistry.get(s.id)),
  );
}
