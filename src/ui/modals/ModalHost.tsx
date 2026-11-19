import { useUiStore } from '@/store/uiStore';
import { Modal } from '../components/controls';
import { ShortcutsModal } from './ShortcutsModal';

function ComingSoon({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={520}
      footer={<button onClick={onClose}>Close</button>}
    >
      <p className="muted">This part of the app is on its way.</p>
    </Modal>
  );
}

export function ModalHost() {
  const open = useUiStore((s) => s.openModal);
  const close = () => useUiStore.getState().openModalId(null);
  switch (open) {
    case null:
      return null;
    case 'shortcuts':
      return <ShortcutsModal onClose={close} />;
    case 'newSong':
      return <ComingSoon title="Start a song" onClose={close} />;
    case 'browser':
      return <ComingSoon title="Choose a sound" onClose={close} />;
    case 'sampleEditor':
      return <ComingSoon title="Edit sample" onClose={close} />;
    case 'export':
      return <ComingSoon title="Export" onClose={close} />;
    case 'credits':
      return <ComingSoon title="Credits" onClose={close} />;
  }
}
