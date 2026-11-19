export function Timeline() {
  return (
    <div
      aria-label="Song timeline"
      data-region="Timeline"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}
    >
      <span className="muted small" style={{ padding: 10, display: 'block' }}>
        Song timeline
      </span>
    </div>
  );
}
