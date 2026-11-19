import type { ChordStamp } from '@/store/uiStore';

/** Scale degrees placed by one click. Stacking every other scale degree keeps chords in key. */
export function chordDegrees(root: number, stamp: ChordStamp): number[] {
  if (stamp === 'triad') return [root, root + 2, root + 4];
  if (stamp === 'seventh') return [root, root + 2, root + 4, root + 6];
  return [root];
}
