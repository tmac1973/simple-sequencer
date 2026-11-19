import { useEffect } from 'react';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { selectedPatternOf } from './hooks/selection';
import { togglePlay } from './transport';

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / stop'],
  ['1 – 9', 'Choose track 1–9'],
  ['[  /  ]', 'Previous / next pattern'],
  ['Ctrl/⌘ + Z', 'Undo'],
  ['Ctrl/⌘ + Shift + Z  or  Ctrl + Y', 'Redo'],
  ['?', 'Show this list'],
  ['Esc', 'Close a window'],
];

function typing(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const ui = useUiStore.getState();
      const song = useSongStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (ui.openModal) {
        if (e.key === ' ' && ui.openModal !== 'shortcuts') return;
      }
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) song.redo();
        else song.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        song.redo();
        return;
      }
      if (mod || e.altKey) return;
      if (e.key === ' ') {
        // Space always means play/stop, never "press the focused button".
        e.preventDefault();
        e.stopPropagation();
        void togglePlay();
        return;
      }
      if (ui.openModal) return;
      if (/^[1-9]$/.test(e.key)) {
        const t = song.song.tracks[Number(e.key) - 1];
        if (t) ui.selectTrack(t.id);
        return;
      }
      if (e.key === '[' || e.key === ']') {
        const t = song.song.tracks.find((x) => x.id === ui.selectedTrackId) ?? song.song.tracks[0];
        if (!t) return;
        const i = t.patterns.indexOf(selectedPatternOf(t));
        const n =
          t.patterns[(i + (e.key === ']' ? 1 : -1) + t.patterns.length) % t.patterns.length]!;
        ui.selectPattern(t.id, n.id);
        return;
      }
      if (e.key === '?') ui.openModalId('shortcuts');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !typing(e) && !useUiStore.getState().openModal) e.preventDefault();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, []);
}
