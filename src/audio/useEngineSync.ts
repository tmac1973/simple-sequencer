import { useEffect } from 'react';
import { useSongStore } from '@/store/songStore';
import { useUiStore, type UiState } from '@/store/uiStore';
import { engine } from './engine';
import type { PlayContext } from './scheduler';

export const playContextOf = (
  u: Pick<UiState, 'playMode' | 'selectedTrackId' | 'selectedPatternId'>,
): PlayContext => ({
  playMode: u.playMode,
  selectedTrackId: u.selectedTrackId,
  selectedPatternId: u.selectedPatternId,
});

/** Keep the engine in step with the stores. Mount once at the app root. */
export function useEngineSync() {
  useEffect(() => {
    engine.setSong(useSongStore.getState().song);
    engine.setPlayContext(playContextOf(useUiStore.getState()));
    const a = useSongStore.subscribe((s, prev) => {
      if (s.song !== prev.song) engine.setSong(s.song);
    });
    const b = useUiStore.subscribe((u, prev) => {
      if (
        u.playMode !== prev.playMode ||
        u.selectedTrackId !== prev.selectedTrackId ||
        u.selectedPatternId !== prev.selectedPatternId
      ) {
        engine.setPlayContext(playContextOf(u));
      }
    });
    return () => {
      a();
      b();
      engine.stop();
    };
  }, []);
}
