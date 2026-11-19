import { create } from 'zustand';
import type { Song } from '@/model/types';
import type { PlayContext } from '@/audio/scheduler';
import { encodeWav } from '@/audio/wav';
import { downloadBlob, safeFileName } from '@/storage/songFile';
import { planRender, renderSong, type RenderRange } from './render';
import { encodeMp3 } from './mp3';

export type ExportFormat = 'mp3' | 'wav';
export interface ExportOptions {
  format: ExportFormat;
  range: RenderRange;
  mp3Kbps: 128 | 192 | 320;
  wavBits: 16 | 24;
}

export type ExportStage = 'idle' | 'rendering' | 'encoding' | 'done' | 'error' | 'cancelled';

export const useExport = create<{ stage: ExportStage; progress: number; message: string | null }>(
  () => ({ stage: 'idle', progress: 0, message: null }),
);

export function exportFilename(song: Song, format: ExportFormat, date = new Date()): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${safeFileName(song.name)} - ${d}.${format}`;
}

let abort: AbortController | null = null;

export function cancelExport() {
  abort?.abort();
}

/** Render + encode + download. Rendering progress is estimated (Tone.Offline has no events). */
export async function runExport(song: Song, ctx: PlayContext, opts: ExportOptions): Promise<void> {
  abort?.abort();
  const ac = new AbortController();
  abort = ac;
  const set = useExport.setState;
  set({ stage: 'rendering', progress: 0, message: null });
  const plan = planRender(song, ctx, opts.range);
  const expectedMs = Math.max(400, plan.totalSeconds * 1000 * 0.4);
  const started = performance.now();
  const encShare = opts.format === 'mp3' ? 0.4 : 0.05;
  const tick = setInterval(() => {
    const p = 1 - Math.exp(-(performance.now() - started) / expectedMs);
    set({ progress: Math.min(0.95, p) * (1 - encShare) });
  }, 100);
  try {
    const buffer = await renderSong(song, ctx, opts.range);
    clearInterval(tick);
    if (ac.signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
    set({ stage: 'encoding', progress: 1 - encShare });
    let blob: Blob;
    if (opts.format === 'wav') blob = encodeWav(buffer, opts.wavBits);
    else
      blob = await encodeMp3(
        buffer,
        opts.mp3Kbps,
        (p) => set({ progress: 1 - encShare + p * encShare }),
        ac.signal,
      );
    downloadBlob(blob, exportFilename(song, opts.format));
    set({ stage: 'done', progress: 1 });
  } catch (e) {
    clearInterval(tick);
    if ((e as Error).name === 'AbortError') set({ stage: 'cancelled', progress: 0 });
    else set({ stage: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    if (abort === ac) abort = null;
  }
}
