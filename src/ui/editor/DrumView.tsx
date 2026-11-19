import { blockAt } from '@/model/timing';
import type { Pattern, Track } from '@/model/types';
import { getLoopRegion } from '@/audio/scheduler';
import { playContextOf } from '@/audio/useEngineSync';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { selectedPatternOf } from '../hooks/selection';
import { StepRow, useCurrentStep } from './StepPads';
import styles from './Editor.module.css';

function DrumRow({
  track,
  pattern,
  selected,
  columns,
}: {
  track: Track;
  pattern: Pattern;
  selected: boolean;
  columns: number;
}) {
  const now = useCurrentStep(track, pattern);
  const total = pattern.lengthBars * pattern.stepsPerBar;
  return (
    <>
      <button
        className={`${styles.drumName} ${selected ? styles.sel : ''}`}
        onClick={() => useUiStore.getState().selectTrack(track.id)}
      >
        <i style={{ background: track.color }} />
        {track.name} <small>· {pattern.name}</small>
      </button>
      <div style={{ width: `${(total / columns) * 100}%` }}>
        <StepRow
          track={track}
          pattern={pattern}
          from={0}
          count={total}
          now={now}
          className={styles.drumPads}
        />
      </div>
    </>
  );
}

/** Every drum (non-melodic sample) track stacked like a classic drum machine. */
export function DrumView() {
  const song = useSongStore((s) => s.song);
  const ui = useUiStore();
  const region = getLoopRegion(song, playContextOf(ui));
  const drums = song.tracks.filter((t) => t.kind === 'sample' && !t.sample?.melodic);
  const rows = drums.map((t) => {
    const pattern =
      t.id === ui.selectedTrackId
        ? selectedPatternOf(t)
        : (blockAt(t, region.startBar)?.pattern ?? selectedPatternOf(t));
    return { t, pattern };
  });
  const columns = Math.max(16, ...rows.map((r) => r.pattern.lengthBars * r.pattern.stepsPerBar));
  if (!drums.length) return <div className={styles.empty}>No drum tracks yet.</div>;
  return (
    <div className={styles.drum}>
      {rows.map(({ t, pattern }) => (
        <DrumRow
          key={t.id}
          track={t}
          pattern={pattern}
          selected={t.id === ui.selectedTrackId}
          columns={columns}
        />
      ))}
    </div>
  );
}
