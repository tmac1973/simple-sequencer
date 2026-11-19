import { CHORDS, BASSLINES, MELODIES } from './tonal';
import { FILLS, GROOVES, PERCUSSION } from './drums';
import { GENRES, type Genre, type IdeaCategory, type PatternIdea } from './model';

export * from './model';

export const IDEAS: PatternIdea[] = [
  ...GROOVES,
  ...FILLS,
  ...PERCUSSION,
  ...BASSLINES,
  ...CHORDS,
  ...MELODIES,
];

const BY_ID = new Map(IDEAS.map((i) => [i.id, i]));
export const ideaById = (id: string) => BY_ID.get(id);

const genreLabel = (g: Genre) => GENRES.find((x) => x.id === g)?.label ?? g;

/**
 * Ideas in a category, optionally filtered by genre. A search looks across every category
 * (names, descriptions and genres) so "shuffle" finds the shuffle wherever it lives.
 */
export function findIdeas(
  category: IdeaCategory,
  genre: Genre | null,
  query: string,
): PatternIdea[] {
  const q = query.trim().toLowerCase().replace(/[-–]/g, ' ');
  return IDEAS.filter((i) => {
    if (genre && !i.genres.includes(genre)) return false;
    if (!q) return i.category === category;
    const hay = `${i.name} ${i.description} ${i.genres.map(genreLabel).join(' ')}`
      .toLowerCase()
      .replace(/[-–]/g, ' ');
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}
