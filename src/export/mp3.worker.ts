/// <reference lib="webworker" />
import { encodeMp3Pcm } from './mp3core';

let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data as
    | { type: 'encode'; left: Float32Array; right: Float32Array; sampleRate: number; kbps: number }
    | { type: 'cancel' };
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  cancelled = false;
  try {
    const bytes = await encodeMp3Pcm(
      msg.left,
      msg.right,
      msg.sampleRate,
      msg.kbps,
      (p) => self.postMessage({ type: 'progress', p }),
      () => cancelled,
    );
    self.postMessage({ type: 'done', bytes }, [bytes.buffer]);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
      cancelled,
    });
  }
};
