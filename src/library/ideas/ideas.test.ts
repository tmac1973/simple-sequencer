import { MAX_BPM, MAX_SWING, MIN_BPM } from '@/model/constants';
import { findIdeas, GENRES, IDEA_CATEGORIES, IDEAS, ideaById, isDrumCategory, KITS } from '.';
import { drumIdea, hitsOf } from './model';
import manifest from '../../../public/samples/manifest.json';

describe('pattern ideas content', () => {
  it('has 61 ideas in the planned groups', () => {
    const count = (c: string) => IDEAS.filter((i) => i.category === c).length;
    expect(IDEAS).toHaveLength(61);
    expect([
      count('groove'),
      count('fill'),
      count('perc'),
      count('bass'),
      count('chords'),
      count('melody'),
    ]).toEqual([22, 6, 5, 12, 10, 6]);
  });

  it('has unique ids and names', () => {
    expect(new Set(IDEAS.map((i) => i.id)).size).toBe(IDEAS.length);
    expect(new Set(IDEAS.map((i) => i.name)).size).toBe(IDEAS.length);
  });

  it.each(IDEAS.map((i) => [i.id, i] as const))('%s is valid', (_, idea) => {
    const total = idea.bars * idea.grid;
    expect([1, 2, 3, 4]).toContain(idea.bars);
    expect([16, 24]).toContain(idea.grid);
    expect(idea.bpm[0]).toBeGreaterThanOrEqual(MIN_BPM);
    expect(idea.bpm[1]).toBeLessThanOrEqual(MAX_BPM);
    expect(idea.bpm[0]).toBeLessThanOrEqual(idea.bpm[1]);
    if (idea.swing !== undefined) {
      expect(idea.swing).toBeGreaterThanOrEqual(0);
      expect(idea.swing).toBeLessThanOrEqual(MAX_SWING);
    }
    expect(idea.genres.length).toBeGreaterThan(0);
    expect(idea.description.length).toBeGreaterThan(10);
    if (isDrumCategory(idea.category)) {
      expect(idea.notes).toBeUndefined();
      const parts = Object.values(idea.parts ?? {});
      expect(parts.length).toBeGreaterThan(0);
      for (const steps of parts) {
        expect(steps.length).toBeGreaterThan(0);
        for (const s of steps) {
          expect(Number.isInteger(s.index)).toBe(true);
          expect(s.index).toBeGreaterThanOrEqual(0);
          expect(s.index).toBeLessThan(total);
          expect(s.velocity).toBeGreaterThanOrEqual(0.1);
          expect(s.velocity).toBeLessThanOrEqual(1);
        }
        expect(new Set(steps.map((s) => s.index)).size).toBe(steps.length);
      }
    } else {
      expect(idea.parts).toBeUndefined();
      expect(idea.notes?.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const n of idea.notes!) {
        expect(Number.isInteger(n.degree)).toBe(true);
        expect(n.degree).toBeGreaterThanOrEqual(-14);
        expect(n.degree).toBeLessThanOrEqual(21);
        expect(n.start).toBeGreaterThanOrEqual(0);
        expect(n.length).toBeGreaterThanOrEqual(1);
        expect(n.start + n.length).toBeLessThanOrEqual(total);
        expect(n.velocity).toBeGreaterThanOrEqual(0.1);
        expect(n.velocity).toBeLessThanOrEqual(1);
        const k = `${n.start}:${n.degree}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    }
    for (const id of idea.pairsWith ?? []) expect(ideaById(id), `pairsWith ${id}`).toBeDefined();
  });

  it('every genre chip and category finds something', () => {
    for (const g of GENRES)
      expect(
        IDEAS.some((i) => i.genres.includes(g.id)),
        g.id,
      ).toBe(true);
    for (const c of IDEA_CATEGORIES) expect(findIdeas(c.id, null, '').length).toBeGreaterThan(0);
  });

  it('every kit sound exists in the bundled library', () => {
    const ids = new Set(manifest.samples.map((s) => s.id));
    for (const kit of Object.values(KITS))
      for (const id of Object.values(kit)) expect(ids.has(id), id).toBe(true);
  });

  it('search looks across categories and ignores dashes', () => {
    expect(findIdeas('groove', null, 'walking').map((i) => i.id)).toEqual(['bass-walking']);
    expect(findIdeas('bass', null, 'boom bap').map((i) => i.id)).toEqual([
      'boom-bap-straight',
      'boom-bap-swung',
    ]);
    expect(findIdeas('groove', 'reggae', '').map((i) => i.id)).toEqual(['reggae-one-drop']);
  });

  it('parses drum lines and rejects wrong lengths', () => {
    expect(hitsOf('X.x. o.g. 5...')).toEqual([
      { index: 0, velocity: 1 },
      { index: 2, velocity: 0.85 },
      { index: 4, velocity: 0.6 },
      { index: 6, velocity: 0.3 },
      { index: 8, velocity: 0.5 },
    ]);
    expect(() => hitsOf('X?..')).toThrow();
    expect(() =>
      drumIdea({
        id: 'x',
        name: 'x',
        category: 'groove',
        genres: ['pop'],
        description: 'too short line',
        bpm: [90, 100],
        lines: { kick: 'X...' },
      }),
    ).toThrow(/expected 16/);
  });
});
