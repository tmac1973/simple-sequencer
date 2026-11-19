/** Synth preset display names (filled in by the preset library). */
const names = new Map<string, string>();
export function registerPresetNames(entries: [string, string][]) {
  for (const [id, n] of entries) names.set(id, n);
}
export function presetName(id: string): string {
  return names.get(id) ?? id;
}
