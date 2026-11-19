import { decodeAudio } from './decode';
import { encodeWav } from './wav';

export const MAX_RECORD_SECONDS = 30;

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

export interface Recording {
  /** Resolves with a 16-bit WAV of the recording. */
  stop(): Promise<{ wav: Blob; durationMs: number }>;
  cancel(): void;
  /** 0–1 input level for a meter */
  level(): number;
  startedAt: number;
}

export async function startRecording(onAutoStop?: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const actx = new AudioContext();
  const src = actx.createMediaStreamSource(stream);
  const an = actx.createAnalyser();
  an.fftSize = 1024;
  src.connect(an);
  const data = new Float32Array(an.fftSize);
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType }));
  });
  const cleanup = () => {
    stream.getTracks().forEach((t) => t.stop());
    void actx.close();
    clearTimeout(timer);
  };
  rec.start(100);
  const timer = setTimeout(() => {
    if (rec.state === 'recording') {
      rec.stop();
      onAutoStop?.();
    }
  }, MAX_RECORD_SECONDS * 1000);
  return {
    startedAt: Date.now(),
    level() {
      an.getFloatTimeDomainData(data);
      let s = 0;
      for (const x of data) s += x * x;
      return Math.min(1, Math.sqrt(s / data.length) * 4);
    },
    cancel() {
      if (rec.state !== 'inactive') rec.stop();
      cleanup();
    },
    async stop() {
      if (rec.state !== 'inactive') rec.stop();
      const blob = await done;
      cleanup();
      // Re-encode to WAV so the recording plays in every browser.
      const buf = await decodeAudio(await blob.arrayBuffer());
      return { wav: encodeWav(buf, 16), durationMs: Math.round(buf.duration * 1000) };
    },
  };
}
