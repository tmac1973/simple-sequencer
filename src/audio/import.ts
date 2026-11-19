import { decodeAudio } from './decode';

export const IMPORT_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac'];
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_SECONDS = 60;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export function soundNameFromFile(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 60) || 'My sound'
  );
}

/** Validate an audio file by decoding it. Returns its duration; original bytes are stored as-is. */
export async function checkImport(file: File): Promise<{ durationMs: number }> {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!IMPORT_EXTENSIONS.includes(ext) && !file.type.startsWith('audio/')) {
    throw new ImportError(`"${file.name}" isn't an audio file. Try WAV or MP3.`);
  }
  if (file.size > MAX_IMPORT_BYTES) throw new ImportError(`"${file.name}" is too big (max 20 MB).`);
  let buf: AudioBuffer;
  try {
    buf = await decodeAudio(await file.arrayBuffer());
  } catch {
    throw new ImportError("This file couldn't be read. Try WAV or MP3.");
  }
  if (buf.duration > MAX_IMPORT_SECONDS)
    throw new ImportError(`"${file.name}" is longer than 60 seconds. Trim it first.`);
  return { durationMs: Math.round(buf.duration * 1000) };
}
