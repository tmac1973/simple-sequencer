import { SampleRegistry } from '@/audio/sampleRegistry';
import type { Track } from '@/model/types';
import { useSongStore } from '@/store/songStore';
import { useUiStore } from '@/store/uiStore';
import { toast } from './toast';

export const convertLabel = (t: Track) =>
  t.kind === 'synth' ? '🔁 Make it a sample track' : '🔁 Make it a synth track';

/** Switch a track between synth and sample, show its new sound, and offer Undo. */
export function convertTrack(trackId: string) {
  const store = useSongStore.getState();
  const r = store.convertTrack(trackId);
  const t = useSongStore.getState().song.tracks.find((x) => x.id === trackId);
  if (!r || !t) return;
  if (t.sample) SampleRegistry.warm(t.sample.sampleId);
  useUiStore.getState().selectTrack(trackId);
  useUiStore.getState().setInspectorTab('sound');
  const what =
    t.kind === 'sample'
      ? 'a sample track playing a piano note. Pick any sound with 🔍 Change sound.'
      : 'a synth track. Pick a preset in the Sound tab.';
  const lost = r.droppedLanes
    ? ` ${r.droppedLanes} automation lane${r.droppedLanes > 1 ? 's' : ''} had no match and ${r.droppedLanes > 1 ? 'were' : 'was'} removed.`
    : '';
  toast({
    kind: 'info',
    message: `"${t.name}" is now ${what}${lost}`,
    action: { label: 'Undo', onClick: () => useSongStore.getState().undo() },
    durationMs: 8000,
  });
}
