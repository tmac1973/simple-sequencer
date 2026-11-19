import type { Track } from '@/model/types';

/** Keys of params that have an automation lane on this track, e.g. "fx:<slotId>:cutoff", "track:volume". */
export function automatedKeys(track: Track): Set<string> {
  const s = new Set<string>();
  for (const l of track.automation) {
    const t = l.target;
    if (t.kind === 'fx') s.add(`fx:${t.fxId}:${t.param}`);
    else if (t.kind === 'track') s.add(`track:${t.param}`);
    else if (t.kind === 'synthMacro') s.add(`macro:${t.macro}`);
    else s.add('sampleTone');
  }
  return s;
}

export const useAutomatedParams = automatedKeys;
