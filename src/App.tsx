import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';
import { registerLibraryResolver } from './library/libraryResolver';
import { loadManifest } from './library/manifest';
import { useSongStore } from './store/songStore';
import { createDevSong } from './dev/devSong';

registerDevSamples();
registerLibraryResolver();
loadManifest().catch((e) => console.warn('[library]', e));
useSongStore.getState().loadSong(createDevSong());

export function App() {
  useEngineSync();
  return <AppShell />;
}
