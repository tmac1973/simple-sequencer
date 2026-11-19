import { engine } from '@/audio/engine';
import { useUiStore } from '@/store/uiStore';

export async function togglePlay() {
  const ui = useUiStore.getState();
  if (ui.playing) {
    engine.stop();
    ui.setPlaying(false);
  } else {
    await engine.play(ui.playMode === 'song' ? ui.songStartBar : 0);
    useUiStore.getState().setPlaying(true);
  }
}

export function stopPlayback() {
  engine.stop();
  useUiStore.getState().setPlaying(false);
}
