export function EditorPanel() {
  return (
    <div
      aria-label="Pattern editor"
      data-region="EditorPanel"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}
    >
      <span className="muted small" style={{ padding: 10, display: 'block' }}>
        Pattern editor
      </span>
    </div>
  );
}
