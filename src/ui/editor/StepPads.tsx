import { useRef } from 'react';
import { newId } from '@/model/factories';
import type { Pattern, Track } from '@/model/types';
import { patternStepAt } from '@/audio/scheduler';
import { playContextOf } from '@/audio/useEngineSync';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { usePlayDerived } from '../hooks/usePlayhead';
import { tip } from '../tooltips';
import styles from './Editor.module.css';

export function useCurrentStep(track: Track, pattern: Pattern): number | null {
  return usePlayDerived((pos) => {
    if (!pos) return null;
    const song = useSongStore.getState().song;
    const t = song.tracks.find((x) => x.id === track.id);
    if (!t) return null;
    return patternStepAt(song, playContextOf(useUiStore.getState()), t, pattern, pos.beat);
  });
}

/** One pad: click toggles; vertical drag on an active pad sets velocity (or chance). */
function Pad({
  track,
  pattern,
  index,
  now,
}: {
  track: Track;
  pattern: Pattern;
  index: number;
  now: boolean;
}) {
  const step = pattern.steps.find((s) => s.index === index);
  const drag = useRef<{ y: number; v: number; g: string; moved: boolean } | null>(null);
  const a = useSongStore.getState();
  const perBeat = pattern.stepsPerBar / 4;
  const chanceMode = useUiStore((s) => s.dragSets) === 'chance';
  const chance = step?.chance ?? 1;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <button
      className={`${styles.pad} ${index % perBeat === 0 ? styles.beat : ''} ${step ? styles.on : ''} ${now ? styles.now : ''} ${step && chanceMode ? styles.chancePad : ''}`}
      style={step && chanceMode ? { borderColor: track.color, color: track.color } : undefined}
      aria-label={`Step ${index + 1}${step ? ` on, ${pct(step.velocity)}${step.chance !== undefined ? `, plays ${pct(chance)} of the time` : ''}` : ' off'}`}
      aria-pressed={!!step}
      data-step={index}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const start =
          useUiStore.getState().dragSets === 'chance' ? chance : (step?.velocity ?? 0.8);
        drag.current = { y: e.clientY, v: start, g: newId(), moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || !step) return;
        const dy = d.y - e.clientY;
        if (Math.abs(dy) > 3) d.moved = true;
        if (!d.moved) return;
        if (useUiStore.getState().dragSets === 'chance')
          a.setStepChance(track.id, pattern.id, index, d.v + dy / 80, d.g);
        else a.setStepVelocity(track.id, pattern.id, index, d.v + dy / 80, d.g);
      }}
      onPointerUp={() => {
        if (drag.current && !drag.current.moved) a.toggleStep(track.id, pattern.id, index);
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          a.toggleStep(track.id, pattern.id, index);
        }
      }}
      {...tip(chanceMode ? 'stepChance' : 'step')}
    >
      {step && chanceMode ? (
        <>
          <span
            className={styles.vel}
            style={{ height: pct(chance), background: `${track.color}40` }}
          />
          <b className={styles.chancePct}>{pct(chance)}</b>
        </>
      ) : (
        step && (
          <>
            <span
              className={styles.vel}
              style={{
                height: `${step.velocity * 100}%`,
                background: track.color,
                opacity: 0.45 + step.velocity * 0.55,
              }}
            />
            {step.chance !== undefined && <span className={styles.dice}>🎲</span>}
          </>
        )
      )}
    </button>
  );
}

export function StepRow({
  track,
  pattern,
  from,
  count,
  now,
  className,
}: {
  track: Track;
  pattern: Pattern;
  from: number;
  count: number;
  now: number | null;
  className?: string;
}) {
  return (
    <div
      className={className ?? styles.barRow}
      style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
    >
      {Array.from({ length: count }, (_, i) => (
        <Pad
          key={from + i}
          track={track}
          pattern={pattern}
          index={from + i}
          now={now === from + i}
        />
      ))}
    </div>
  );
}

export function StepEditor({ track, pattern }: { track: Track; pattern: Pattern }) {
  const now = useCurrentStep(track, pattern);
  const spb = pattern.stepsPerBar;
  const perBeat = spb / 4;
  return (
    <>
      <div className={styles.bars}>
        {Array.from({ length: pattern.lengthBars }, (_, bar) => (
          <div key={bar}>
            <StepRow track={track} pattern={pattern} from={bar * spb} count={spb} now={now} />
            {bar === 0 && (
              <div
                className={styles.nums}
                style={{ gridTemplateColumns: `repeat(${spb}, 1fr)`, marginTop: 4 }}
              >
                {Array.from({ length: spb }, (_, i) => (
                  <span key={i}>{i % perBeat === 0 ? i / perBeat + 1 : '·'}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.hint}>
        <span>
          <b>Click</b> a step to turn it on/off
        </span>
        <DragHint />
        <span>
          <kbd>Space</kbd> play
        </span>
        <span>
          <kbd>1</kbd>–<kbd>9</kbd> choose track
        </span>
        <KeysHint />
      </div>
    </>
  );
}

function DragHint() {
  const chance = useUiStore((s) => s.dragSets) === 'chance';
  return chance ? (
    <span>
      <b>Drag up/down</b> on a step to set how often it plays
    </span>
  ) : (
    <span>
      <b>Drag up/down</b> on a step to make it louder/softer
    </span>
  );
}

function KeysHint() {
  const on = useUiStore((s) => s.keysOn);
  const all = useUiStore((s) => s.drumView);
  if (!on) return null;
  return all ? (
    <span>
      <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>… play each drum
    </span>
  ) : (
    <span>
      <kbd>A</kbd>–<kbd>L</kbd> play this drum
    </span>
  );
}
