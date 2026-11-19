import { memo, useEffect, useRef, useState } from 'react';
import { MAX_SONG_BARS } from '@/model/constants';
import { newId } from '@/model/factories';
import { blockAt } from '@/model/timing';
import type { Pattern, Track } from '@/model/types';
import { getLoopRegion, usesNotes } from '@/audio/scheduler';
import { playContextOf } from '@/audio/useEngineSync';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { selectedPatternOf, useSelection } from '../hooks/selection';
import { usePlayheadFrame } from '../hooks/usePlayhead';
import { tip } from '../tooltips';
import { emitScroll } from './scrollSync';
import { LaneTimelineRows } from './LaneTimelineRows';
import styles from './Timeline.module.css';

export const BAR_W = 64;

export function PatternPreview({ track, pattern }: { track: Track; pattern: Pattern }) {
  const total = pattern.lengthBars * pattern.stepsPerBar;
  if (usesNotes(track)) {
    if (!pattern.notes.length) return null;
    const lo = Math.min(...pattern.notes.map((n) => n.degree));
    const hi = Math.max(...pattern.notes.map((n) => n.degree));
    const span = Math.max(4, hi - lo + 1);
    return (
      <svg viewBox={`0 0 ${total} ${span}`} preserveAspectRatio="none" aria-hidden>
        {pattern.notes.map((n, i) => (
          <rect
            key={i}
            x={n.start}
            y={span - 1 - (n.degree - lo)}
            width={n.length}
            height={0.8}
            fill="#000"
          />
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${total} 4`} preserveAspectRatio="none" aria-hidden>
      {pattern.steps.map((s) => (
        <rect
          key={s.index}
          x={s.index}
          y={4 - 4 * s.velocity}
          width={Math.max(0.35, total / 90)}
          height={4 * s.velocity}
          fill="#000"
        />
      ))}
    </svg>
  );
}

interface Span {
  start: number;
  end: number;
  pattern: Pattern;
  joinL: boolean;
  joinR: boolean;
}

/** Visible spans of each block (later blocks cut off earlier ones). */
export function blockSpans(track: Track): Span[] {
  const sorted = [...track.blocks].sort((a, b) => a.startBar - b.startBar);
  const spans: Span[] = [];
  sorted.forEach((b, i) => {
    const p = track.patterns.find((x) => x.id === b.patternId);
    if (!p) return;
    const next = sorted[i + 1];
    const end = Math.min(b.startBar + p.lengthBars, next ? next.startBar : Infinity);
    spans.push({ start: b.startBar, end, pattern: p, joinL: false, joinR: false });
  });
  for (let i = 1; i < spans.length; i++) {
    const a = spans[i - 1]!;
    const b = spans[i]!;
    if (a.end === b.start && a.pattern.id === b.pattern.id) {
      a.joinR = true;
      b.joinL = true;
    }
  }
  return spans;
}

const TimelineRow = memo(function TimelineRow({
  track,
  selected,
  bars,
}: {
  track: Track;
  selected: boolean;
  bars: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ mode: 'paint' | 'erase'; g: string; last: number } | null>(null);
  const a = useSongStore.getState();

  const barAt = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.floor((e.clientX - r.left) / BAR_W);
  };
  const apply = (bar: number) => {
    const d = drag.current;
    if (!d || bar < 0 || bar >= MAX_SONG_BARS) return;
    const t = useSongStore.getState().song.tracks.find((x) => x.id === track.id);
    if (!t) return;
    const occupied = !!blockAt(t, bar);
    if (d.mode === 'paint' && !occupied) a.paintBlock(t.id, selectedPatternOf(t).id, bar, d.g);
    if (d.mode === 'erase' && occupied) a.removeBlockAt(t.id, bar, d.g);
    d.last = bar;
  };

  return (
    <div
      className={`${styles.row} ${selected ? styles.sel : ''}`}
      style={{ width: bars * BAR_W, color: track.color }}
      aria-label={`${track.name} timeline`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        useUiStore.getState().selectTrack(track.id);
        const bar = barAt(e);
        drag.current = { mode: blockAt(track, bar) ? 'erase' : 'paint', g: newId(), last: -1 };
        setDragging(true);
        apply(bar);
      }}
      onPointerMove={(e) => {
        const bar = barAt(e);
        setHover(bar);
        if (drag.current && bar !== drag.current.last) apply(bar);
      }}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerLeave={() => setHover(null)}
      {...tip(hover !== null && blockAt(track, hover) ? 'timelineBlock' : 'timelineEmpty')}
    >
      {blockSpans(track).map((s) => (
        <div
          key={`${s.start}`}
          className={`${styles.blk} ${s.joinL ? styles.joinL : ''} ${s.joinR ? styles.joinR : ''}`}
          style={{
            left: s.start * BAR_W + (s.joinL ? 0 : 2),
            width: (s.end - s.start) * BAR_W - (s.joinL ? 0 : 2) - (s.joinR ? 0 : 2),
            background: track.patterns.indexOf(s.pattern) % 2 ? `${track.color}c0` : track.color,
          }}
        >
          <PatternPreview track={track} pattern={s.pattern} />
          <span style={{ position: 'relative' }}>{s.joinL ? '' : s.pattern.name}</span>
        </div>
      ))}
      {hover !== null && !dragging && !blockAt(track, hover) && (
        <div
          className={styles.ghost}
          style={{
            left: hover * BAR_W + 2,
            width: selectedPatternOf(track).lengthBars * BAR_W - 4,
          }}
        />
      )}
    </div>
  );
});

function Ruler({ bars }: { bars: number }) {
  const song = useSongStore((s) => s.song);
  const ui = useUiStore();
  const region = getLoopRegion(song, playContextOf(ui));
  const inLoop = (b: number) => b >= region.startBar && b < region.startBar + region.lengthBars;
  return (
    <div className={styles.ruler} style={{ width: bars * BAR_W + 120 }}>
      {Array.from({ length: bars }, (_, b) => (
        <div
          key={b}
          className={`${styles.rc} ${(ui.playMode === 'pattern' ? inLoop(b) : false) ? styles.loop : ''}`}
          onClick={() => ui.setSongStartBar(b)}
          {...tip('ruler')}
        >
          {b + 1}
          {ui.playMode === 'song' && ui.songStartBar === b && (
            <span className={styles.flag}>▼</span>
          )}
        </div>
      ))}
      <button
        className={styles.addBars}
        disabled={song.lengthBars >= MAX_SONG_BARS}
        onClick={() => useSongStore.getState().setLength(song.lengthBars + 4)}
        {...tip('addBars')}
      >
        ＋ 4 bars
      </button>
    </div>
  );
}

export function Timeline() {
  const tracks = useSongStore((s) => s.song.tracks);
  const lengthBars = useSongStore((s) => s.song.lengthBars);
  const { track: sel } = useSelection();
  const head = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const bars = lengthBars;

  usePlayheadFrame((pos) => {
    const el = head.current;
    if (!el) return;
    if (!pos) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.style.left = `${(pos.beat / 4) * BAR_W}px`;
  });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const fn = () => emitScroll(el.scrollTop);
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className={styles.timeline} ref={scroller} data-timeline-scroll aria-label="Song timeline">
      <div className={styles.inner} style={{ width: bars * BAR_W + 120 }}>
        <Ruler bars={bars} />
        {tracks.map((t) => (
          <div key={t.id}>
            <TimelineRow track={t} selected={t.id === sel?.id} bars={bars} />
            <LaneTimelineRows track={t} bars={bars} />
          </div>
        ))}
        <div style={{ height: 92 }} />
        <div className={styles.end} style={{ left: bars * BAR_W }} />
        <div ref={head} className={styles.playhead} style={{ bottom: 92 }} />
      </div>
    </div>
  );
}
