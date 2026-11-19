import type { Track } from '@/model/types';
import { tip } from '../tooltips';

export function EffectsTab(_props: { track: Track }) {
  return (
    <p className="muted small" {...tip('comingSoon')}>
      Coming soon.
    </p>
  );
}
