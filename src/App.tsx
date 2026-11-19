import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';
import { registerLibraryResolver } from './library/libraryResolver';
import { loadManifest } from './library/manifest';
import { registerUserResolver } from './storage/userSamples';
import { useSongStore } from './store/songStore';
import { buildLofi } from './templates/lofi';
import { startPersistence } from './storage/session';

registerDevSamples();
registerLibraryResolver();
registerUserResolver();
loadManifest().catch((e) => console.warn('[library]', e));
useSongStore.getState().loadSong(buildLofi());
if (typeof indexedDB !== 'undefined')
  void startPersistence().catch((e) => console.warn('[storage]', e));

export function App() {
  useEngineSync();
  return <AppShell />;
}
