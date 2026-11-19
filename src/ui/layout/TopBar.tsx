export function TopBar() {
  return (
    <header
      aria-label="Top bar"
      data-region="TopBar"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}
    >
      <span className="muted small" style={{ padding: 10, display: 'block' }}>
        Top bar
      </span>
    </header>
  );
}
