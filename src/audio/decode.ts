let decoder: OfflineAudioContext | null = null;

/** Decode compressed audio without needing a running (user-started) AudioContext. */
export function decodeAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  decoder ??= new OfflineAudioContext(1, 1, 44100);
  return decoder.decodeAudioData(data);
}
