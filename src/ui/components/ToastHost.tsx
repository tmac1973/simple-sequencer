import { useToasts } from '../toast';

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  if (!toasts.length) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
      }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.kind === 'error' ? '#3a1d24' : 'var(--panel3)',
            border: `1px solid ${t.kind === 'error' ? 'var(--bad)' : 'var(--line)'}`,
            color: 'var(--text)',
            borderRadius: 10,
            padding: '10px 14px',
            boxShadow: '0 10px 30px rgba(0,0,0,.45)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            maxWidth: 560,
            fontSize: 13.5,
          }}
        >
          <span>
            {t.kind === 'error' ? '⚠️ ' : ''}
            {t.message}
          </span>
          {t.action && (
            <button
              className="primary"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="ghost icon" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
