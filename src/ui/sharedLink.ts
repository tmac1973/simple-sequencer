import { SongFormatError } from '@/model/schema';
import { useUiStore } from '@/store/uiStore';
import { decodeShare, shareDataFromHash } from '@/storage/shareLink';
import { toastError } from './toast';

/**
 * If the page was opened with a share link (#song=…), offer to open it, then tidy the address
 * bar so a reload doesn't ask again.
 */
export function checkSharedLink() {
  if (typeof location === 'undefined') return;
  const data = shareDataFromHash(location.hash);
  if (!data) return;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    const song = decodeShare(data);
    const ui = useUiStore.getState();
    ui.setSharedSong(song);
    ui.openModalId('openShared');
  } catch (e) {
    toastError(e instanceof SongFormatError ? e : new SongFormatError(String(e)));
  }
}

/** Check now and whenever a share link is pasted into the address bar of an open app. */
export function watchSharedLinks() {
  checkSharedLink();
  window.addEventListener('hashchange', checkSharedLink);
}
