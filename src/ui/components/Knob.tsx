import { useRef } from 'react';
import { newId } from '@/model/factories';
import styles from './components.module.css';

export interface KnobProps {
  label: string;
  /** 0–1 */
  value: number;
  defaultValue?: number;
  format?: (v: number) => string;
  color?: string;
  size?: number;
  tipKey?: string;
  disabled?: boolean;
  automated?: boolean;
  onChange?: (v: number, gestureId: string) => void;
}

const A0 = -225;
const A1 = 45;

function arc(r: number, cx: number, cy: number, s: number, e: number) {
  const p = (a: number) => [
    cx + r * Math.cos((a * Math.PI) / 180),
    cy + r * Math.sin((a * Math.PI) / 180),
  ];
  const [x0, y0] = p(s);
  const [x1, y1] = p(e);
  return `M${x0} ${y0} A${r} ${r} 0 ${e - s > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

export function KnobSvg({
  value,
  color = 'var(--accent)',
  size = 52,
}: {
  value: number;
  color?: string;
  size?: number;
}) {
  const v = Math.min(1, Math.max(0, value));
  const a = A0 + (A1 - A0) * v;
  const hx = 26 + 13 * Math.cos((a * Math.PI) / 180);
  const hy = 26 + 13 * Math.sin((a * Math.PI) / 180);
  return (
    <svg viewBox="0 0 52 52" width={size} height={size} aria-hidden>
      <path
        d={arc(20, 26, 26, A0, A1)}
        stroke="#3a3e55"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {v > 0.002 && (
        <path
          d={arc(20, 26, 26, A0, a)}
          stroke={color}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
      )}
      <circle cx={26} cy={26} r={14} fill="#2c3042" />
      <line x1={26} y1={26} x2={hx} y2={hy} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

/** Drag-to-turn knob: 150 px = full range, Shift = fine, double-click = reset, arrows when focused. */
export function Knob({
  label,
  value,
  defaultValue = 0.5,
  format,
  color,
  size = 52,
  tipKey,
  disabled,
  automated,
  onChange,
}: KnobProps) {
  const drag = useRef<{ y: number; v: number; id: string } | null>(null);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const locked = disabled || automated;
  const emit = (v: number, id: string) => !locked && onChange?.(clamp(v), id);

  const onPointerDown = (e: React.PointerEvent) => {
    if (locked || e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, v: value, id: newId() };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const scale = e.shiftKey ? 600 : 150;
    emit(d.v + (d.y - e.clientY) / scale, d.id);
  };
  const end = () => (drag.current = null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.01 : 0.05;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') emit(value + step, newId());
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') emit(value - step, newId());
    else if (e.key === 'Home') emit(0, newId());
    else if (e.key === 'End') emit(1, newId());
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const text = format ? format(value) : `${Math.round(value * 100)}%`;
  return (
    <div
      className={`${styles.knob} ${locked ? styles.disabled : ''}`}
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={text}
      aria-disabled={disabled || undefined}
      tabIndex={0}
      data-tip={
        automated
          ? 'Automated|This knob is automated. Edit its lane in the timeline.'
          : (tipKey ?? 'knob')
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => emit(defaultValue, newId())}
      onKeyDown={onKeyDown}
    >
      <KnobSvg value={value} color={color} size={size} />
      <div className={styles.kl}>
        {label}
        {automated && <span className={styles.auto}>∿</span>}
      </div>
      <div className={styles.kv}>{text}</div>
    </div>
  );
}
