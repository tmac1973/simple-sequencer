import { MAX_SONG_BARS } from './constants';
import { newId } from './factories';
import { valueAt } from './automation';
import { blockAt, contentEndBar } from './timing';
import type { AutomationLane, Song, Track } from './types';

/*
 * Whole-song bar editing (the ruler's right-click menu). Every function changes the song in
 * place, so the store runs it inside one undoable recipe. Bars are 0-based.
 */

/** Does a block start before `bar` and still play at `bar`? */
function straddles(t: Track, b: Track['blocks'][number], bar: number): boolean {
  return b.startBar < bar && blockAt(t, bar)?.block.id === b.id;
}

/** Keep automation flat across a gap: pin the value at both edges. */
function holdAround(lane: AutomationLane, at: number, count: number) {
  if (lane.points.length === 0) return;
  const v = valueAt(lane, at);
  if (v === null) return;
  const before = lane.points.filter((p) => p.bar < at);
  const after = lane.points.filter((p) => p.bar >= at).map((p) => ({ ...p, bar: p.bar + count }));
  const edge = [{ bar: at, value: v }];
  if (after.length && after[0]!.bar > at + count) edge.push({ bar: at + count, value: v });
  lane.points = [...before, ...(before.length ? edge : []), ...after].filter(
    (p, i, a) => i === 0 || p.bar !== a[i - 1]!.bar || p.value !== a[i - 1]!.value,
  );
}

/** Can `count` bars be added without anything running past the 128-bar limit? */
export function canInsertBars(song: Song, count: number): boolean {
  return contentEndBar(song) + count <= MAX_SONG_BARS && song.lengthBars < MAX_SONG_BARS;
}

/**
 * Insert `count` empty bars before bar `at`. Everything from there on slides right on every
 * track. A block that starts earlier but is still playing at `at` moves too, so nothing is cut
 * in half (unless `keepStraddling`, used by duplicate).
 */
export function insertBars(song: Song, at: number, count: number, keepStraddling = false) {
  if (!canInsertBars(song, count) || at < 0 || at > song.lengthBars) return false;
  for (const t of song.tracks) {
    for (const b of t.blocks)
      if (b.startBar >= at || (!keepStraddling && straddles(t, b, at))) b.startBar += count;
    t.blocks.sort((x, y) => x.startBar - y.startBar);
    for (const lane of t.automation) holdAround(lane, at, count);
  }
  song.lengthBars = Math.min(MAX_SONG_BARS, song.lengthBars + count);
  return true;
}

/** Copy bars [from, from + count) and insert the copy right after them. */
export function duplicateBars(song: Song, from: number, count: number) {
  if (from < 0 || from + count > song.lengthBars) return false;
  const source = song.tracks.map((t) => ({
    blocks: t.blocks.filter((b) => b.startBar >= from && b.startBar < from + count),
    lanes: t.automation.map((l) => l.points.filter((p) => p.bar >= from && p.bar < from + count)),
  }));
  if (!insertBars(song, from + count, count, true)) return false;
  song.tracks.forEach((t, i) => {
    for (const b of source[i]!.blocks)
      t.blocks.push({ id: newId(), patternId: b.patternId, startBar: b.startBar + count });
    t.blocks.sort((x, y) => x.startBar - y.startBar);
    t.automation.forEach((lane, j) => {
      const copies = source[i]!.lanes[j]!.map((p) => ({ bar: p.bar + count, value: p.value }));
      if (!copies.length) return;
      lane.points = [
        ...lane.points.filter((p) => p.bar < from + count || p.bar >= from + 2 * count),
        ...copies,
      ].sort((a, b) => a.bar - b.bar);
    });
  });
  return true;
}

/** Remove bars [from, from + count) and close the gap. */
export function deleteBars(song: Song, from: number, count: number) {
  if (from < 0 || count < 1 || from >= song.lengthBars) return false;
  const end = from + count;
  for (const t of song.tracks) {
    t.blocks = t.blocks
      .filter((b) => b.startBar < from || b.startBar >= end)
      .map((b) => (b.startBar >= end ? { ...b, startBar: b.startBar - count } : b));
    for (const lane of t.automation) {
      const v = lane.points.length ? valueAt(lane, end) : null;
      const before = lane.points.filter((p) => p.bar < from);
      const after = lane.points
        .filter((p) => p.bar >= end)
        .map((p) => ({ ...p, bar: p.bar - count }));
      lane.points = [
        ...before,
        ...(v !== null && before.length && (!after.length || after[0]!.bar > from)
          ? [{ bar: from, value: v }]
          : []),
        ...after,
      ];
    }
  }
  song.lengthBars = Math.max(1, contentEndBar(song), song.lengthBars - count);
  return true;
}
