import { createSong } from '@/model/factories';
import type { Song, Track } from '@/model/types';
import { drumTrack, hits, place, repeat, synthTrack } from './helpers';

/** Start from scratch: one drum track with a simple kick and one empty synth. */
export function buildEmpty(): Song {
  const tracks: Track[] = [];
  const drums = drumTrack(
    'Drums',
    'lib:dusty-kick',
    [{ name: 'A', steps: hits([0, 8], 0.9) }],
    tracks,
  );
  place(drums, repeat(1, 4, 'A'));
  synthTrack('Bass', 'warm-bass', [{ name: 'A' }], tracks);
  return createSong({
    name: 'My Song',
    bpm: 90,
    key: { root: 0, scale: 'minor' },
    lengthBars: 8,
    tracks,
  });
}
