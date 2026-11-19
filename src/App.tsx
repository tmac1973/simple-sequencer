import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';
import { useSongStore } from './store/songStore';
import { createDevSong } from './dev/devSong';

registerDevSamples();
useSongStore.getState().loadSong(createDevSong());

export function App() {
  useEngineSync();
  return <AppShell />;
}
