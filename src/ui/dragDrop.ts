import { useEffect } from 'react';
import { IMPORT_EXTENSIONS } from '@/audio/import';
import { useUiStore } from '@/store/uiStore';
import { importFiles } from './modals/MySounds';
import { importSongFromFile } from './modals/SongLibrary';

const isSongFile = (f: File) => /\.(json|zip)$/i.test(f.name);
const isAudio = (f: File) =>
  f.type.startsWith('audio/') || IMPORT_EXTENSIONS.some((e) => f.name.toLowerCase().endsWith(e));

/** Drop a song file anywhere to open it; drop audio files to add them to My Sounds. */
export function useWindowDrop() {
  useEffect(() => {
    const over = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      e.preventDefault();
      const song = files.find(isSongFile);
      if (song) {
        useUiStore.getState().openModalId(null);
        void importSongFromFile(song);
        return;
      }
      const audio = files.filter(isAudio);
      if (audio.length) {
        void importFiles(audio).then((added) => {
          if (added.length) useUiStore.getState().openModalId('browser');
        });
      }
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
}
