import type { Song } from '@/model/types';
import { buildEmpty } from './empty';
import { buildHiphop } from './hiphop';
import { buildHouse } from './house';
import { buildLofi } from './lofi';
import { buildTriphop } from './triphop';

export interface Template {
  id: 'empty' | 'lofi' | 'house' | 'hiphop' | 'triphop';
  name: string;
  description: string;
  build(): Song;
}

export const TEMPLATES: Template[] = [
  {
    id: 'empty',
    name: 'Empty',
    description: 'Start from scratch with one drum track and one synth.',
    build: buildEmpty,
  },
  {
    id: 'lofi',
    name: 'Lo-fi Beat',
    description: '84 BPM · dusty drums, jazzy keys, warm bass',
    build: buildLofi,
  },
  {
    id: 'house',
    name: 'House',
    description: '124 BPM · four-on-the-floor, offbeat hats, stab chords',
    build: buildHouse,
  },
  {
    id: 'hiphop',
    name: 'Hip-hop',
    description: '92 BPM · boom-bap drums, triplet hats, piano, vocal chop',
    build: buildHiphop,
  },
  {
    id: 'triphop',
    name: 'Trip-hop',
    description: '82 BPM · heavy dusty drums, vinyl, dark pad, vibes in echo',
    build: buildTriphop,
  },
];

/** Kits a song uses (for preloading). */
export function kitsUsed(song: Song): string[] {
  const ids = song.tracks
    .map((t) => t.sample?.sampleId)
    .filter((x): x is string => !!x && x.startsWith('lib:'));
  return [...new Set(ids)];
}
