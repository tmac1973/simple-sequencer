/** Encode a rendered buffer to MP3 in a Web Worker (keeps the UI responsive). */
export function encodeMp3(
  buffer: AudioBuffer,
  kbps: 128 | 192 | 320,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' });
    const left = buffer.getChannelData(0).slice();
    const right = (
      buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)
    ).slice();
    const finish = () => worker.terminate();
    signal?.addEventListener('abort', () => {
      worker.postMessage({ type: 'cancel' });
      finish();
      reject(new DOMException('Export cancelled', 'AbortError'));
    });
    worker.onmessage = (e) => {
      const m = e.data as { type: string; p?: number; bytes?: Uint8Array; message?: string };
      if (m.type === 'progress') onProgress(m.p ?? 0);
      else if (m.type === 'done') {
        finish();
        resolve(new Blob([m.bytes! as BlobPart], { type: 'audio/mpeg' }));
      } else if (m.type === 'error') {
        finish();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      finish();
      reject(new Error(e.message || 'MP3 encoder failed'));
    };
    worker.postMessage({ type: 'encode', left, right, sampleRate: buffer.sampleRate, kbps }, [
      left.buffer,
      right.buffer,
    ]);
  });
}
