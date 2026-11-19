import { AppShell } from './ui/layout/AppShell';
import { useEngineSync } from './audio/useEngineSync';
import { registerDevSamples } from './audio/devSamples';

registerDevSamples();

export function App() {
  useEngineSync();
  return <AppShell />;
}
