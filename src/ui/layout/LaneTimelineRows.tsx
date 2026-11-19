import { useRef, useState } from 'react';
import { newId } from '@/model/factories';
import type { AutomationLane, AutomationPoint, Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { targetOption } from '../automationTargets';

const H = 64;
const PAD = 6;
const BAR_W = 64;

function LaneRow({ track, lane, bars }: { track: Track; lane: AutomationLane; bars: number }) {
  const a = useSongStore.getState();
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; g: string } | { draw: true; g: string; last: number } | null>(
    null,
  );
  const [hover, setHover] = useState<number | null>(null);
  const opt = targetOption(track, lane.target);
  const w = bars * BAR_W;
  const x = (bar: number) => bar * BAR_W;
  const y = (v: number) => PAD + (1 - v) * (H - 2 * PAD);
  const pos = (e: React.PointerEvent | React.MouseEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const bar = Math.max(0, Math.min(bars, (e.clientX - r.left) / BAR_W));
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - r.top - PAD) / (H - 2 * PAD)));
    return { bar, v };
  };
  const snap = (bar: number, free: boolean) => (free ? bar : Math.round(bar * 4) / 4);
  const pts = lane.points;
  const set = (p: AutomationPoint[], g?: string) => a.setLanePoints(track.id, lane.id, p, g);

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    const { bar, v } = pos(e);
    setHover(bar);
    if (!d) return;
    const cur =
      useSongStore
        .getState()
        .song.tracks.find((t) => t.id === track.id)
        ?.automation.find((l) => l.id === lane.id)?.points ?? [];
    if ('draw' in d) {
      const nb = snap(bar, false);
      if (nb === d.last) return;
      d.last = nb;
      set([...cur.filter((p) => p.bar !== nb), { bar: nb, value: v }], d.g);
      return;
    }
    const prev = cur[d.i - 1];
    const next = cur[d.i + 1];
    const nb = Math.max(prev?.bar ?? 0, Math.min(next?.bar ?? bars, snap(bar, e.altKey)));
    set(
      cur.map((p, i) => (i === d.i ? { bar: nb, value: v } : p)),
      d.g,
    );
  };

  const path = pts.length
    ? `M0 ${y(pts[0]!.value)} ` +
      pts.map((p) => `L${x(p.bar)} ${y(p.value)}`).join(' ') +
      ` L${w} ${y(pts[pts.length - 1]!.value)}`
    : '';

  return (
    <div
      style={{
        height: H,
        borderBottom: '1px solid var(--line)',
        background: '#171924',
        position: 'relative',
        width: w,
      }}
      aria-label={`${track.name} ${opt.label} automation`}
    >
      <svg
        ref={svg}
        width={w}
        height={H}
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={(e) => {
          if (e.button !== 0 || e.target !== e.currentTarget) return;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          const { bar, v } = pos(e);
          const g = newId();
          const nb = snap(bar, e.altKey);
          if (e.shiftKey) drag.current = { draw: true, g, last: nb };
          set([...pts, { bar: nb, value: v }], g);
        }}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => setHover(null)}
      >
        {Array.from({ length: Math.ceil(bars / 4) }, (_, i) => (
          <line
            key={i}
            x1={i * 4 * BAR_W}
            x2={i * 4 * BAR_W}
            y1={0}
            y2={H}
            stroke="var(--line)"
            pointerEvents="none"
          />
        ))}
        {path && (
          <>
            <path
              d={`${path} L${w} ${H} L0 ${H}Z`}
              fill={`${track.color}22`}
              pointerEvents="none"
            />
            <path
              d={path}
              fill="none"
              stroke={track.color}
              strokeWidth={2.5}
              pointerEvents="none"
            />
          </>
        )}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={x(p.bar)}
            cy={y(p.value)}
            r={5}
            fill={track.color}
            stroke="#10121a"
            strokeWidth={1.5}
            style={{ cursor: 'grab' }}
            role="button"
            aria-label={`Point at bar ${(p.bar + 1).toFixed(2)}: ${opt.format(p.value)}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              drag.current = { i, g: newId() };
            }}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            onDoubleClick={() => set(pts.filter((_, j) => j !== i))}
            onContextMenu={(e) => {
              e.preventDefault();
              set(pts.filter((_, j) => j !== i));
            }}
          >
            <title>{`Bar ${(p.bar + 1).toFixed(2)} · ${opt.format(p.value)}`}</title>
          </circle>
        ))}
        {hover !== null && (
          <line
            x1={hover * BAR_W}
            x2={hover * BAR_W}
            y1={0}
            y2={H}
            stroke="#ffffff22"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

/** Automation lane rows under a track in the timeline. */
export function LaneTimelineRows({ track, bars }: { track: Track; bars: number }) {
  return (
    <>
      {track.automation
        .filter((l) => l.visible)
        .map((l) => (
          <LaneRow key={l.id} track={track} lane={l} bars={bars} />
        ))}
    </>
  );
}
