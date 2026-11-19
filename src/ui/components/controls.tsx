import { useEffect, useRef, type ReactNode } from 'react';
import styles from './components.module.css';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tipKey,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  tipKey?: string;
}) {
  return (
    <div className={styles.seg} role="radiogroup" aria-label={label} data-tip={tipKey}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? styles.on : ''}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  on,
  children,
  onClick,
  tipKey,
  label,
}: {
  on?: boolean;
  children: ReactNode;
  onClick?: () => void;
  tipKey?: string;
  label?: string;
}) {
  return (
    <button
      className={`${styles.chip} ${on ? styles.on : ''}`}
      aria-pressed={on}
      onClick={onClick}
      data-tip={tipKey}
      aria-label={label}
    >
      {children}
    </button>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  tipKey,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  tipKey?: string;
}) {
  return (
    <button
      className={`${styles.toggle} ${on ? styles.on : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-tip={tipKey}
      onClick={() => onChange(!on)}
    />
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 820,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    node?.querySelector<HTMLElement>('button, input, select, [tabindex]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && node) {
        const f = [
          ...node.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input, select, [tabindex="0"]',
          ),
        ];
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={styles.modal}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div className={styles.modalH}>
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.modalB}>{children}</div>
        {footer && <div className={styles.modalF}>{footer}</div>}
      </div>
    </div>
  );
}

export interface MenuItem {
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tip?: string;
  separator?: boolean;
  custom?: ReactNode;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    document.addEventListener('keydown', key);
    const r = ref.current?.getBoundingClientRect();
    if (r && ref.current) {
      if (r.bottom > window.innerHeight)
        ref.current.style.top = `${window.innerHeight - r.height - 8}px`;
      if (r.right > window.innerWidth)
        ref.current.style.left = `${window.innerWidth - r.width - 8}px`;
    }
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={styles.menu} style={{ left: x, top: y }} role="menu">
      {items.map((it, i) =>
        it.separator ? (
          <hr key={i} />
        ) : it.custom ? (
          <div key={i}>{it.custom}</div>
        ) : (
          <button
            key={i}
            role="menuitem"
            disabled={it.disabled}
            data-tip={it.tip}
            onClick={() => {
              it.onClick?.();
              onClose();
            }}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
}

export const swatchStyles = styles;
