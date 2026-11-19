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
