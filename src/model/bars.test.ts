import { createLane, createSampleTrack, createSong } from './factories';
import { MAX_SONG_BARS } from './constants';
import { blockAt } from './timing';
import type { Song, Track } from './types';
import { canInsertBars, deleteBars, duplicateBars, insertBars } from './bars';
import { buildLofi } from '@/templates/lofi';
import { useSongStore } from '@/store/songStore';

/** A track with pattern A (1 bar) and B (2 bars) placed as [bar, name] pairs. */
function song(placement: [number, 'A' | 'B'][], lengthBars = 8): Song {
  const t = createSampleTrack({ name: 'Drums' });
  t.patterns = [
    { ...t.patterns[0]!, id: 'pa', name: 'A', lengthBars: 1 },
    { ...t.patterns[0]!, id: 'pb', name: 'B', lengthBars: 2 },
  ];
  t.blocks = placement.map(([bar, n], i) => ({
    id: `b${i}`,
    patternId: `p${n.toLowerCase()}`,
    startBar: bar,
  }));
  return createSong({ lengthBars, tracks: [t] });
}
/** What plays in each bar, e.g. "AA-B" (B shown on its first bar, "b" after). */
const view = (t: Track, bars: number) =>
  Array.from({ length: bars }, (_, bar) => {
    const h = blockAt(t, bar);
    if (!h) return '-';
    return h.block.startBar === bar ? h.pattern.name : h.pattern.name.toLowerCase();
  }).join('');

describe('bar editing', () => {
  it('inserts empty bars at the start', () => {
    const s = song(
      [
        [0, 'A'],
        [1, 'A'],
        [2, 'B'],
      ],
      4,
    );
    insertBars(s, 0, 2);
    expect(view(s.tracks[0]!, 6)).toBe('--AABb');
    expect(s.lengthBars).toBe(6);
  });

  it('inserts in the middle and never cuts a block in half', () => {
    const s = song(
      [
        [0, 'A'],
        [1, 'B'],
        [3, 'A'],
      ],
      4,
    );
    insertBars(s, 2, 1); // bar 3 is the middle of B
    expect(view(s.tracks[0]!, 5)).toBe('A-BbA');
  });

  it('duplicates a section right after itself', () => {
    const s = song(
      [
        [0, 'A'],
        [1, 'B'],
        [3, 'A'],
      ],
      4,
    );
    duplicateBars(s, 0, 3);
    expect(view(s.tracks[0]!, 7)).toBe('ABbABbA');
    expect(s.lengthBars).toBe(7);
  });

  it('deletes bars and closes the gap', () => {
    const s = song(
      [
        [0, 'A'],
        [1, 'B'],
        [3, 'A'],
        [4, 'A'],
      ],
      8,
    );
    deleteBars(s, 1, 2);
    expect(view(s.tracks[0]!, 3)).toBe('AAA');
    expect(s.lengthBars).toBe(6);
  });

  it('moves automation with the music and holds it across inserted bars', () => {
    const s = song([[0, 'A']], 4);
    s.tracks[0]!.automation = [
      createLane({ kind: 'track', param: 'volume' }, [
        { bar: 0, value: 0 },
        { bar: 4, value: 1 },
      ]),
    ];
    insertBars(s, 2, 2);
    expect(s.tracks[0]!.automation[0]!.points).toEqual([
      { bar: 0, value: 0 },
      { bar: 2, value: 0.5 },
      { bar: 4, value: 0.5 },
      { bar: 6, value: 1 },
    ]);
    deleteBars(s, 2, 2);
    expect(s.tracks[0]!.automation[0]!.points.map((p) => p.bar)).toEqual([0, 2, 4]);
  });

  it('refuses to push music past 128 bars', () => {
    const s = song([[MAX_SONG_BARS - 2, 'A']], MAX_SONG_BARS);
    expect(canInsertBars(s, 4)).toBe(false);
    expect(insertBars(s, 0, 4)).toBe(false);
    expect(s.tracks[0]!.blocks[0]!.startBar).toBe(MAX_SONG_BARS - 2);
  });

  it('is one undo step in the store', () => {
    const store = useSongStore.getState();
    store.loadSong(buildLofi());
    const before = useSongStore.getState().song;
    expect(useSongStore.getState().duplicateBars(4, 4)).toBe(true);
    expect(useSongStore.getState().song.lengthBars).toBe(before.lengthBars + 4);
    useSongStore.getState().undo();
    expect(useSongStore.getState().song).toEqual(before);
  });
});
