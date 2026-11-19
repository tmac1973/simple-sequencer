export function Inspector() {
  return (
    <aside
      aria-label="Inspector"
      data-region="Inspector"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}
    >
      <span className="muted small" style={{ padding: 10, display: 'block' }}>
        Inspector
      </span>
    </aside>
  );
}
