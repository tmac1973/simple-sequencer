/** Display names for sample ids. Sources register lookups by prefix (dev:, lib:, user:). */
type Lookup = (id: string) => { name: string; detail?: string } | undefined;
const lookups = new Map<string, Lookup>();
const listeners = new Set<() => void>();

export function registerSoundNames(prefix: string, fn: Lookup) {
  lookups.set(prefix, fn);
  listeners.forEach((l) => l());
}

export function soundInfo(id: string): { name: string; detail?: string } {
  const prefix = id.slice(0, id.indexOf(':'));
  return lookups.get(prefix)?.(id) ?? { name: id.slice(id.indexOf(':') + 1) || id };
}

export function onSoundNamesChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

registerSoundNames('dev', (id) => {
  const names: Record<string, string> = {
    'dev:kick': 'Test Kick',
    'dev:snare': 'Test Snare',
    'dev:hat': 'Test Hat',
    'dev:tone': 'Test Tone',
  };
  return names[id] ? { name: names[id]!, detail: 'Built-in test sound' } : undefined;
});
