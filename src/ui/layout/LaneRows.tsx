import type { Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { targetOption } from '../automationTargets';
import { DEFAULT_LFO, LFO_RATE_SHORT } from '@/model/lfo';
import styles from './TrackList.module.css';

/** Automation lane rows under a track in the track list. */
export function LaneRows({ track }: { track: Track }) {
  const a = useSongStore.getState();
  return (
    <>
      {track.automation
        .filter((l) => l.visible)
        .map((l) => (
          <div
            key={l.id}
            className={styles.lane}
            data-tip="Automation lane|The line shows how this knob changes over the song. Click to add points, drag to move them, double-click to delete."
          >
            {l.target.kind === 'lfo' ? '\u00a0\u00a0↳ ' : '↳ '}
            <b>{targetOption(track, l.target).label}</b>
            {l.mode === 'lfo' && (
              <span className={styles.wobbleBadge}>
                〰 {LFO_RATE_SHORT[l.lfo?.rate ?? DEFAULT_LFO.rate]}
              </span>
            )}
            <button
              className="ghost"
              aria-label={`Hide ${targetOption(track, l.target).label} lane`}
              onClick={() => a.setLaneVisible(track.id, l.id, false)}
              data-tip="Hide|Hide this lane. It still plays."
            >
              👁
            </button>
            <button
              className="ghost"
              aria-label={`Delete ${targetOption(track, l.target).label} lane`}
              onClick={() => a.removeLane(track.id, l.id)}
              data-tip="Delete lane|Remove this automation. The knob goes back to its normal value."
            >
              ✕
            </button>
          </div>
        ))}
    </>
  );
}
