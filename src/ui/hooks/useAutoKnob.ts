import { targetKey } from '@/model/automation';
import type { AutomationTarget, Track } from '@/model/types';
import { useAutomatedValue } from './useAutomatedValue';

/** Is this knob automated, and what value is it at right now while playing? */
export function useAutoKnob(
  track: Track,
  target: AutomationTarget,
): { automated: boolean; live: number | null } {
  const k = targetKey(target);
  const automated = track.automation.some((l) => targetKey(l.target) === k && l.points.length > 0);
  const live = useAutomatedValue(track.id, automated ? target : null);
  return { automated, live };
}
