import { targetKey, targetStatic } from '@/model/automation';
import type { Track } from '@/model/types';
import { FX_DEFS } from '@/audio/effects/registry';
import { useSongStore } from '@/store/songStore';
import { Chip } from '../components/controls';
import { targetOption, targetsFor } from '../automationTargets';
import styles from './Inspector.module.css';

export function AutomateTab({ track }: { track: Track }) {
  const a = useSongStore.getState();
  const lengthBars = useSongStore((s) => s.song.lengthBars);
  const used = new Set(track.automation.map((l) => targetKey(l.target)));
  const options = targetsFor(track).filter((o) => !used.has(targetKey(o.target)));
  return (
    <>
      <div className="sect">Automation for {track.name}</div>
      {track.automation.length === 0 && (
        <p className="small muted">
          Nothing automated yet. Automation makes a knob move by itself as the song plays, like a
          filter sweep that opens up into the chorus.
        </p>
      )}
      {track.automation.map((l) => {
        const o = targetOption(track, l.target);
        return (
          <div key={l.id} className={styles.fx}>
            <div className={styles.fxHead}>
              <b>{o.label}</b>
              <Chip
                on={l.visible}
                onClick={() => a.setLaneVisible(track.id, l.id, !l.visible)}
                tipKey="laneShow"
              >
                {l.visible ? 'Shown' : 'Hidden'}
              </Chip>
              <button
                className="ghost icon"
                aria-label={`Delete ${o.label} automation`}
                onClick={() => a.removeLane(track.id, l.id)}
                data-tip="Delete lane|Remove this automation. The knob goes back to its normal value."
              >
                ✕
              </button>
            </div>
            <div className="small muted">
              {l.points.length} points · edit the line in the timeline
            </div>
          </div>
        );
      })}
      <div className="sect" style={{ marginTop: 14 }}>
        Add a lane: choose a knob to automate
      </div>
      <div className={styles.presets}>
        {options.map((o) => (
          <Chip
            key={targetKey(o.target)}
            tipKey="laneAdd"
            onClick={() => {
              const fxDef =
                o.target.kind === 'fx'
                  ? FX_DEFS[
                      track.fx.find((f) => f.id === (o.target as { fxId: string }).fxId)!.type
                    ]
                  : null;
              const def = fxDef?.main.find(
                (p) => p.key === (o.target as { param?: string }).param,
              )?.default;
              const v = targetStatic(track, o.target, def);
              a.addLane(track.id, o.target, [
                { bar: 0, value: v },
                { bar: lengthBars, value: v },
              ]);
            }}
          >
            ＋ {o.label}
          </Chip>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>
        Lanes appear under the track in the timeline. Click to add points, drag to move them,
        double-click to delete. Hold Shift and drag to draw.
      </p>
    </>
  );
}
