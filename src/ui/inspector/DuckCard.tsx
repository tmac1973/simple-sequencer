import type { Track } from '@/model/types';
import {
  DUCK_RELEASE_LABELS,
  DUCK_RELEASES,
  defaultDuckSource,
  kickTrack,
  PUMP_PRESET,
} from '@/model/groove';
import { useSongStore } from '@/store/songStore';
import { Knob } from '../components/Knob';
import { Toggle } from '../components/controls';
import { tip } from '../tooltips';
import styles from './Inspector.module.css';

const last = DUCK_RELEASES.length - 1;

/** A picture of the pump: the volume dips at each hit and swells back. */
function PumpPicture({
  amount,
  release,
  color,
}: {
  amount: number;
  release: number;
  color: string;
}) {
  const W = 240;
  const H = 40;
  const beat = W / 4;
  const tau = ((DUCK_RELEASES[release] ?? 1) * beat) / 4;
  let d = '';
  for (let x = 0; x <= W; x += 2) {
    const since = x % beat;
    const v = 1 - amount * Math.exp(-since / tau);
    d += `${x ? 'L' : 'M'}${x} ${(4 + (1 - v) * (H - 10)).toFixed(1)}`;
  }
  return (
    <svg className={styles.pump} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * beat} y={H - 5} width={3} height={5} fill="#ff6b6b" />
      ))}
    </svg>
  );
}

/** Sidechain pump: "Duck when [Kick] plays", at the top of the Effects tab. */
export function DuckCard({ track }: { track: Track }) {
  const tracks = useSongStore((s) => s.song.tracks);
  const a = useSongStore.getState();
  const others = tracks.filter((t) => t.id !== track.id);
  const duck = track.duck;
  if (!duck) {
    if (!others.length) return null;
    const kick = kickTrack(tracks, track.id);
    return (
      <div className={styles.presets} style={{ marginBottom: 12 }}>
        {kick ? (
          <button
            className={`small ${styles.pumpBtn}`}
            onClick={() => a.setDuck(track.id, { sourceId: kick.id, on: true, ...PUMP_PRESET })}
            {...tip('pump')}
          >
            💓 Pump to the kick
          </button>
        ) : (
          <button
            className="small"
            onClick={() =>
              a.setDuck(track.id, {
                sourceId: defaultDuckSource(tracks, track.id)!.id,
                on: true,
                ...PUMP_PRESET,
              })
            }
            {...tip('duckAdd')}
          >
            ⤵ Duck to another track
          </button>
        )}
      </div>
    );
  }
  const source = tracks.find((t) => t.id === duck.sourceId);
  return (
    <div className={styles.fx} aria-label="Duck (pump)">
      <div className={styles.fxHead}>
        <b>⤵ Duck (pump)</b>
        <span data-tip="Duck on/off|Switch the pump off for a moment without losing its settings.">
          <Toggle on={duck.on} label="Duck on" onChange={(on) => a.setDuck(track.id, { on })} />
        </span>
        <button
          className="ghost icon"
          aria-label="Remove duck"
          onClick={() => a.setDuck(track.id, null)}
          data-tip="Remove|Stop this track ducking."
        >
          ✕
        </button>
      </div>
      <label
        className="small"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        {...tip('duckSource')}
      >
        Duck when
        <select
          aria-label="Duck when this track plays"
          value={duck.sourceId}
          onChange={(e) => a.setDuck(track.id, { sourceId: e.target.value })}
        >
          {others.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        plays
      </label>
      <div className={styles.knobs2} style={{ marginTop: 8 }}>
        <Knob
          label="Amount"
          tipKey="duckAmount"
          color={track.color}
          value={duck.amount}
          defaultValue={PUMP_PRESET.amount}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v, g) => a.setDuck(track.id, { amount: v }, g)}
        />
        <Knob
          label="Release"
          tipKey="duckRelease"
          color={track.color}
          value={duck.release / last}
          defaultValue={PUMP_PRESET.release / last}
          format={(v) => DUCK_RELEASE_LABELS[Math.round(v * last)]!}
          onChange={(v, g) => a.setDuck(track.id, { release: Math.round(v * last) }, g)}
        />
      </div>
      <PumpPicture amount={duck.on ? duck.amount : 0} release={duck.release} color={track.color} />
      <div className="small muted">
        This track gets quieter each time {source?.name ?? 'that track'} hits, then swells back: the
        “breathing” sound of house music.
      </div>
    </div>
  );
}
