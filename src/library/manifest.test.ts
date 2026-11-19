import { searchSamples, setManifest, findByRole, type LibraryManifest } from './manifest';
import { soundInfo } from './soundNames';

import manifestJson from '../../public/samples/manifest.json';

const m = manifestJson as unknown as LibraryManifest;

describe('library manifest', () => {
  it('search finds kicks across kits', () => {
    const r = searchSamples(m, 'kick');
    expect(new Set(r.map((s) => s.kit)).size).toBeGreaterThanOrEqual(4);
    expect(r.every((s) => /kick/i.test(`${s.name} ${s.category}`))).toBe(true);
  });
  it('filters by category when there is no query', () => {
    expect(searchSamples(m, '', 'Snares').every((s) => s.category === 'Snares')).toBe(true);
  });
  it('multi-word search matches all words', () => {
    expect(
      searchSamples(m, '808 kick').every((s) => s.kit === '808' && s.category === 'Kicks'),
    ).toBe(true);
  });
  it('every sample has a file, license and credit; melodic ones have a root note', () => {
    for (const s of m.samples) {
      expect(s.file).toMatch(/\.flac$/);
      expect(['CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0']).toContain(s.license);
      expect(s.author).toBeTruthy();
      expect(s.sourceUrl).toMatch(/^https:/);
    }
    expect(
      m.samples
        .filter((s) => s.category === 'Melodic one-shots')
        .every((s) => typeof s.rootNote === 'number'),
    ).toBe(true);
  });
  it('registers names and template roles', () => {
    setManifest(m);
    expect(soundInfo('lib:dusty-kick').name).toBe('Dusty Kick');
    expect(findByRole('house-perc')?.kit).toBe('club');
    expect(findByRole('hiphop-chop')).toBeDefined();
  });
});
