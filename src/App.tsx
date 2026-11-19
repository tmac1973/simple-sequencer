import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';
import { registerLibraryResolver } from './library/libraryResolver';
import { loadManifest } from './library/manifest';
import { registerUserResolver } from './storage/userSamples';
import { useSongStore } from './store/songStore';
import { buildLofi } from './templates/lofi';

registerDevSamples();
registerLibraryResolver();
registerUserResolver();
loadManifest().catch((e) => console.warn('[library]', e));
useSongStore.getState().loadSong(buildLofi());

export function App() {
  useEngineSync();
  return <AppShell />;
}
