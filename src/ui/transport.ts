import { engine } from '@/audio/engine';
import { useUiStore } from '@/store/uiStore';
import { toastError } from './toast';

export async function togglePlay() {
  const ui = useUiStore.getState();
  if (ui.playing) {
    engine.stop();
    ui.setPlaying(false);
    return;
  }
  // flip the state first so a quick second press means "stop"
  ui.setPlaying(true);
  try {
    await engine.play(ui.playMode === 'song' ? ui.songStartBar : 0);
  } catch (e) {
    engine.stop();
    useUiStore.getState().setPlaying(false);
    toastError(e);
  }
}

export function stopPlayback() {
  engine.stop();
  useUiStore.getState().setPlaying(false);
}
