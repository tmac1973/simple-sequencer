import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { resolveTip, type TipCopy } from '../tooltips';
import styles from './components.module.css';

/** One global tooltip, shown after 400 ms hover over any element with data-tip. */
export function TooltipLayer() {
  const enabled = useUiStore((s) => s.tipsEnabled);
  const [state, setState] = useState<{ copy: TipCopy; x: number; y: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    let current: Element | null = null;
    const over = (e: MouseEvent) => {
      const target = (e.target as Element | null)?.closest?.('[data-tip]') ?? null;
      if (target === current) return;
      current = target;
      window.clearTimeout(timer.current);
      setState(null);
      if (!target) return;
      timer.current = window.setTimeout(() => {
        const copy = resolveTip(target.getAttribute('data-tip') ?? '');
        if (!copy) return;
        const r = target.getBoundingClientRect();
        setState({ copy, x: r.left, y: r.bottom + 8 });
      }, 400);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      current = null;
      setState(null);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', hide);
    document.addEventListener('keydown', hide);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', hide);
      document.removeEventListener('keydown', hide);
      window.clearTimeout(timer.current);
    };
  }, [enabled]);

  // keep on screen
  useEffect(() => {
    const t = el.current;
    if (!t || !state) return;
    const r = t.getBoundingClientRect();
    let { x, y } = state;
    if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight - 8) y = y - r.height - 52;
    t.style.left = `${Math.max(8, x)}px`;
    t.style.top = `${Math.max(8, y)}px`;
  }, [state]);

  if (!state || !enabled) return null;
  return (
    <div ref={el} className={styles.tooltip} role="tooltip" style={{ left: state.x, top: state.y }}>
      <b>{state.copy.title}</b>
      {state.copy.body}
    </div>
  );
}
