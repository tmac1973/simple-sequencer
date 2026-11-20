import { describe, it, expect } from 'vitest';
import src from '../samples-src/sources.json' with { type: 'json' };
import { validateSources, ALLOWED_LICENSES } from './sources-lib.mjs';

describe('samples-src/sources.json', () => {
  it('is valid: allowed licenses, sources, unique ids', () => {
    expect(validateSources(src)).toEqual([]);
  });
  it('only uses CC0 or CC-BY', () => {
    for (const e of src.samples) expect(ALLOWED_LICENSES).toContain(e.license);
  });
  it('every drum kit has the minimum kit pieces', () => {
    for (const kit of ['dusty', '808', 'club', 'analog']) {
      const cats = src.samples.filter((e) => e.kit === kit).map((e) => e.category);
      for (const need of ['Kicks', 'Snares', 'Hi-hats', 'Claps & snaps'])
        expect(cats).toContain(need);
    }
  });
  it('accepts layered entries and flags bad layers', () => {
    const entry = (layers) => ({
      id: 'c',
      kit: 'k',
      category: 'Guitars',
      license: 'CC0-1.0',
      sourceUrl: 'https://x',
      author: 'a',
      layers,
    });
    const check = (layers) => validateSources({ kits: [{ id: 'k' }], samples: [entry(layers)] });
    expect(
      check([
        { url: 'https://x/a.wav', atMs: 0 },
        { url: 'https://x/b.wav', atMs: 16 },
      ]),
    ).toEqual([]);
    expect(check([{ url: 'http://x/a.wav', atMs: 0 }])).toHaveLength(1);
    expect(check([{ url: 'https://x/a.wav' }])).toHaveLength(1);
  });
  it('flags bad entries', () => {
    expect(
      validateSources({
        kits: [{ id: 'k' }],
        samples: [
          {
            id: 'x',
            kit: 'k',
            category: 'Kicks',
            license: 'CC-BY-NC-4.0',
            sourceUrl: 'http://x',
            author: '',
          },
        ],
      }).length,
    ).toBeGreaterThan(2);
  });
});
