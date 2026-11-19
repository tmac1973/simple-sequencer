import { useEffect, useState } from 'react';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';

export const SEEN_HINT_KEY = 'ss:seenHint';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_HINT_KEY) === '1';
  } catch {
    return true;
  }
}
function markSeen() {
  try {
    localStorage.setItem(SEEN_HINT_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Two gentle tips on the very first visit: press play, then click a square. Completely
 * click-through, so it never blocks anything; Esc hides it, and it goes away for good afterwards.
 */
export function FirstRunHint() {
  const [step, setStep] = useState<0 | 1 | 2>(() => (seen() ? 2 : 0));
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const modalOpen = useUiStore((u) => u.openModal !== null);
  // advance: step 0 → 1 when the user plays; step 1 → done on their first edit
  useEffect(
    () =>
      useUiStore.subscribe((u) => {
        if (u.playing) setStep((p) => (p === 0 ? 1 : p));
      }),
    [],
  );
  useEffect(
    () =>
      useSongStore.subscribe((s, prev) => {
        if (s.past.length > prev.past.length)
          setStep((p) => {
            if (p !== 1) return p;
            markSeen();
            return 2;
          });
      }),
    [],
  );

  useEffect(() => {
    if (step === 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setStep(2);
      markSeen();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [step]);

  useEffect(() => {
    if (step === 2) return;
    const find = () => {
      const el =
        step === 0
          ? document.querySelector(
              'header button[aria-label="Play"], header button[aria-label="Stop"]',
            )
          : document.querySelector('[data-step="0"]');
      setAnchor(el?.getBoundingClientRect() ?? null);
    };
    find();
    const id = window.setInterval(find, 500);
    window.addEventListener('resize', find);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', find);
    };
  }, [step]);

  if (step === 2 || !anchor || modalOpen) return null;
  const text =
    step === 0
      ? 'Press Space or ▶ to hear your song.'
      : 'Click a square to add or remove a drum hit.';
  const top = step === 0 ? anchor.bottom + 10 : anchor.bottom + 26;
  return (
    <div
      role="note"
      aria-label="Tip"
      style={{
        position: 'fixed',
        left: Math.max(8, anchor.left - 4),
        top,
        zIndex: 800,
        pointerEvents: 'none',
        background: 'var(--accent)',
        color: '#fff',
        padding: '9px 12px',
        borderRadius: 10,
        boxShadow: '0 10px 30px rgba(0,0,0,.45)',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <span>
        {step + 1}/2 · {text}
      </span>
      <span style={{ opacity: 0.75, fontWeight: 400, fontSize: 12 }}>Esc to hide</span>
    </div>
  );
}
