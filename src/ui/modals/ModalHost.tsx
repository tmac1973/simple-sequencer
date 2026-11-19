import { useUiStore } from '@/store/uiStore';
import { ShortcutsModal } from './ShortcutsModal';
import { SoundBrowserModal } from './SoundBrowserModal';
import { CreditsModal } from './CreditsModal';
import { SampleEditorModal } from './SampleEditorModal';
import { NewSongModal } from './NewSongModal';
import { ExportModal } from './ExportModal';
import { IdeasModal } from './IdeasModal';
import { OpenSharedModal, ShareModal } from './ShareModal';

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
      return <ExportModal onClose={close} />;
    case 'credits':
      return <CreditsModal onClose={close} />;
    case 'ideas':
      return <IdeasModal onClose={close} />;
    case 'share':
      return <ShareModal onClose={close} />;
    case 'openShared':
      return <OpenSharedModal onClose={close} />;
  }
}
