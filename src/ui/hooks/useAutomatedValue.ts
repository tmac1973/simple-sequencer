import { engine } from '@/audio/engine';
import type { AutomationTarget } from '@/model/types';
import { usePlayDerived } from './usePlayhead';

/** The live automated value (0–1, rounded) of a target while playing; null otherwise. */
export function useAutomatedValue(trackId: string, target: AutomationTarget | null): number | null {
  return usePlayDerived((pos) => {
    if (!pos || !target) return null;
    const v = engine.onParamValue(trackId, target);
    return v === null ? null : Math.round(v * 200) / 200;
  });
}
