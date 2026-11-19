import { useEffect } from 'react';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import type { Pattern, Track } from '@/model/types';

/** The selected track (falls back to the first track) and its selected pattern. */
export function useSelection(): { track: Track | undefined; pattern: Pattern | undefined } {
  const tracks = useSongStore((s) => s.song.tracks);
  const selId = useUiStore((s) => s.selectedTrackId);
  const selPatterns = useUiStore((s) => s.selectedPatternId);
  const track = tracks.find((t) => t.id === selId) ?? tracks[0];
  const pattern = track
    ? (track.patterns.find((p) => p.id === selPatterns[track.id]) ?? track.patterns[0])
    : undefined;
  return { track, pattern };
}

/** Keep the selection valid as tracks come and go. Mount once. */
export function useSelectionGuard() {
  const tracks = useSongStore((s) => s.song.tracks);
  const selId = useUiStore((s) => s.selectedTrackId);
  useEffect(() => {
    if (!tracks.length) return;
    if (!selId || !tracks.some((t) => t.id === selId))
      useUiStore.getState().selectTrack(tracks[0]!.id);
  }, [tracks, selId]);
}

export function selectedPatternOf(track: Track): Pattern {
  const id = useUiStore.getState().selectedPatternId[track.id];
  return track.patterns.find((p) => p.id === id) ?? track.patterns[0]!;
}
