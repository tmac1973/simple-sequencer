import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';
import { registerLibraryResolver } from './library/libraryResolver';
import { loadManifest } from './library/manifest';
import { registerUserResolver } from './storage/userSamples';
import { useSongStore } from './store/songStore';
import { buildLofi } from './templates/lofi';
import { startPersistence } from './storage/session';
import { configureAudioContext } from './audio/context';
import { watchSharedLinks } from './ui/sharedLink';
import { restoreMidi } from './ui/midi';

configureAudioContext();
registerDevSamples();
registerLibraryResolver();
registerUserResolver();
loadManifest().catch((e) => console.warn('[library]', e));
void restoreMidi();
useSongStore.getState().loadSong(buildLofi());
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
if (debug) {
  // QA helpers, only with ?debug in the URL (no autosave in this mode)
  void import('./dev/stress').then(({ buildStressSong }) => {
    (window as unknown as Record<string, unknown>).__ss = {
      loadStress: () => useSongStore.getState().loadSong(buildStressSong()),
      song: () => useSongStore.getState().song,
    };
  });
  if (typeof window !== 'undefined') watchSharedLinks();
} else if (typeof indexedDB !== 'undefined') {
  // restore the last song first, so a shared song opens on top of it (and it stays saved)
  void startPersistence()
    .catch((e) => console.warn('[storage]', e))
    .finally(watchSharedLinks);
}

export function App() {
  useEngineSync();
  return <AppShell />;
}
