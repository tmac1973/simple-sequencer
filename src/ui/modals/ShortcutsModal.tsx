import { Modal } from '../components/controls';
import { SHORTCUTS } from '../shortcuts';

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Keyboard shortcuts"
      onClose={onClose}
      width={520}
      footer={
        <button className="primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '8px 4px', whiteSpace: 'nowrap' }}>
                <kbd>{k}</kbd>
              </td>
              <td style={{ padding: '8px 4px' }}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">
        You can also drag knobs up/down, double-click a knob to reset it, and hold Shift while
        dragging for fine control.
      </p>
    </Modal>
  );
}
