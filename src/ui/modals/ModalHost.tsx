import { useUiStore } from '@/store/uiStore';
import { Modal } from '../components/controls';
import { ShortcutsModal } from './ShortcutsModal';
import { SoundBrowserModal } from './SoundBrowserModal';
import { CreditsModal } from './CreditsModal';
import { SampleEditorModal } from './SampleEditorModal';
import { NewSongModal } from './NewSongModal';

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
      return <NewSongModal onClose={close} />;
    case 'browser':
      return <SoundBrowserModal onClose={close} />;
    case 'sampleEditor':
      return <SampleEditorModal onClose={close} />;
    case 'export':
      return <ComingSoon title="Export" onClose={close} />;
    case 'credits':
      return <CreditsModal onClose={close} />;
  }
}
