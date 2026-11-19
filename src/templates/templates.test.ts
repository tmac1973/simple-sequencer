vi.mock('tone', () => ({}));
import { TEMPLATES } from './index';
import { validateSong } from '@/model/schema';
import { PRESETS } from '@/audio/synthPresets';
import manifestJson from '../../public/samples/manifest.json';
import type { LibraryManifest } from '@/library/manifest';
import { FX_DEFS, allParams } from '@/audio/effects/registry';

const m = manifestJson as unknown as LibraryManifest;
const sampleIds = new Set(m.samples.map((s) => s.id));

describe.each(TEMPLATES.map((t) => [t.id, t] as const))('template %s', (_id, t) => {
  const song = t.build();
  it('is a valid song', () => {
    expect(validateSong(JSON.parse(JSON.stringify(song)))).toEqual(song);
  });
  it('only uses bundled sounds and real presets', () => {
    for (const tr of song.tracks) {
      if (tr.sample) expect(sampleIds.has(tr.sample.sampleId), tr.sample.sampleId).toBe(true);
      if (tr.synth) expect(PRESETS.some((p) => p.id === tr.synth!.presetId)).toBe(true);
    }
  });
  it('blocks point at real patterns and fit in the song', () => {
    for (const tr of song.tracks)
      for (const b of tr.blocks) {
        const p = tr.patterns.find((x) => x.id === b.patternId);
        expect(p).toBeDefined();
        expect(b.startBar + p!.lengthBars).toBeLessThanOrEqual(song.lengthBars);
      }
  });
  it('effect params are in range and known', () => {
    for (const tr of song.tracks)
      for (const f of tr.fx) {
        const keys = allParams(FX_DEFS[f.type]).map((p) => p.key);
        for (const [k, v] of Object.entries(f.params)) {
          expect(keys).toContain(k);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
  });
  it('fresh ids every build', () => {
    expect(t.build().id).not.toBe(song.id);
  });
});

it('templates use the sounds marked for them in the library', () => {
  const role = (r: string) => m.samples.find((s) => s.templateRole === r)!.id;
  const house = TEMPLATES.find((t) => t.id === 'house')!.build();
  expect(house.tracks.some((t) => t.sample?.sampleId === role('house-perc'))).toBe(true);
  const hh = TEMPLATES.find((t) => t.id === 'hiphop')!.build();
  expect(hh.tracks.some((t) => t.sample?.sampleId === role('hiphop-chop'))).toBe(true);
  expect(
    hh.tracks.some((t) => t.sample?.sampleId === role('hiphop-keys') && t.sample.melodic),
  ).toBe(true);
});
