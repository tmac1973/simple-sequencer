import type { Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { targetOption } from '../automationTargets';
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
            ↳ <b>{targetOption(track, l.target).label}</b>
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
