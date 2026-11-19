import { targetKey, targetStatic } from '@/model/automation';
import { LFO_RATE_LABELS, LFO_SHAPES, DEFAULT_LFO } from '@/model/lfo';
import type { AutomationLane, LfoShape, Track } from '@/model/types';
import { FX_DEFS } from '@/audio/effects/registry';
import { useSongStore } from '@/store/songStore';
import { Chip, Segmented } from '../components/controls';
import { Knob } from '../components/Knob';
import { quickWobbles, targetOption, targetsFor } from '../automationTargets';
import { tip } from '../tooltips';
import styles from './Inspector.module.css';

/** Little pictures of each wobble shape. */
const SHAPE_PATHS: Record<LfoShape, string> = {
  sine: 'M1 7 Q7 -4 13 7 T25 7',
  triangle: 'M1 13 L7 1 L13 13 L19 1 L25 13',
  square: 'M1 13 V1 H8 V13 H15 V1 H22 V13',
  rampUp: 'M1 13 L12 1 V13 L24 1 V13',
  rampDown: 'M1 1 L12 13 V1 L24 13 V1',
  random: 'M1 9 H6 V3 H11 V12 H16 V6 H21 V10 H25',
};

export function ShapeIcon({ shape }: { shape: LfoShape }) {
  return (
    <svg width="26" height="14" aria-hidden>
      <path d={SHAPE_PATHS[shape]} stroke="currentColor" fill="none" strokeWidth="1.8" />
    </svg>
  );
}

function WobbleControls({ track, lane }: { track: Track; lane: AutomationLane }) {
  const a = useSongStore.getState();
  const lfo = lane.lfo ?? DEFAULT_LFO;
  const label = targetOption(track, lane.target).label;
  return (
    <div className={styles.wobble}>
      <div className="small muted">Shape</div>
      <div
        className={styles.shapes}
        role="radiogroup"
        aria-label={`${label} wobble shape`}
        {...tip('lfoShape')}
      >
        {LFO_SHAPES.map((s) => (
          <button
            key={s.id}
            role="radio"
            aria-checked={lfo.shape === s.id}
            aria-label={s.label}
            className={lfo.shape === s.id ? styles.on : ''}
            onClick={() => a.setLfo(track.id, lane.id, { shape: s.id })}
          >
            <ShapeIcon shape={s.id} />
          </button>
        ))}
      </div>
      <label className={styles.speed} {...tip('lfoSpeed')}>
        <span className="small muted">Speed</span>
        <select
          aria-label={`${label} wobble speed`}
          value={lfo.rate}
          onChange={(e) => a.setLfo(track.id, lane.id, { rate: Number(e.target.value) })}
        >
          {LFO_RATE_LABELS.map((r, i) => (
            <option key={r} value={i}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.knobRow}>
        <Knob
          label="Amount"
          value={lfo.depth}
          defaultValue={DEFAULT_LFO.depth}
          tipKey="lfoAmount"
          onChange={(v, g) => a.setLfo(track.id, lane.id, { depth: v }, g)}
        />
        <Knob
          label="Centre"
          value={lfo.center}
          defaultValue={targetStatic(track, lane.target)}
          format={targetOption(track, lane.target).format}
          tipKey="lfoCenter"
          onChange={(v, g) => a.setLfo(track.id, lane.id, { center: v }, g)}
        />
      </div>
      <div className="small muted">
        The knob swings this far either side of the centre. Automate the wobble's amount or speed
        below.
      </div>
    </div>
  );
}

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
          filter sweep that opens up into the chorus, or a wobble that never stops.
        </p>
      )}
      {track.automation.map((l) => {
        const o = targetOption(track, l.target);
        const control = l.target.kind === 'lfo';
        const wobbling = l.mode === 'lfo';
        return (
          <div key={l.id} className={`${styles.fx} ${control ? styles.subLane : ''}`}>
            <div className={styles.fxHead}>
              <b>
                {control && '↳ '}
                {o.label}
              </b>
              {!control && (
                <Segmented
                  label={`${o.label} mode`}
                  tipKey="laneMode"
                  value={wobbling ? 'lfo' : 'draw'}
                  onChange={(m) => a.setLaneMode(track.id, l.id, m)}
                  options={[
                    { value: 'draw', label: '✏️ Draw' },
                    { value: 'lfo', label: '〰️ Wobble' },
                  ]}
                />
              )}
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
            {wobbling ? (
              <WobbleControls track={track} lane={l} />
            ) : (
              <div className="small muted">
                {l.points.length} points · edit the line in the timeline
              </div>
            )}
          </div>
        );
      })}
      <div className="sect" style={{ marginTop: 14 }}>
        Quick wobbles
      </div>
      <div className={styles.presets}>
        {quickWobbles(track).map((q) => (
          <Chip
            key={q.id}
            tipKey={`quickWobble.${q.id}`}
            onClick={() => a.addWobble(track.id, q.target, q.lfo)}
          >
            〰 {q.label}
          </Chip>
        ))}
      </div>
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
