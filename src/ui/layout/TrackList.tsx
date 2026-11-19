export function TrackList() {
  return (
    <aside
      aria-label="Tracks"
      data-region="TrackList"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}
    >
      <span className="muted small" style={{ padding: 10, display: 'block' }}>
        Tracks
      </span>
    </aside>
  );
}
