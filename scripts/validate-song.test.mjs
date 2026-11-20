import { describe, it, expect } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { readSongFile } from './validate-song.mjs';

describe('validate-song readSongFile', () => {
  it('reads a .zip with song.json and its own sounds', () => {
    const zip = zipSync({
      'song.json': strToU8(JSON.stringify({ name: 'x' })),
      'samples/index.json': strToU8(
        JSON.stringify([
          { id: 'user:a', name: 'A', mime: 'audio/wav', file: 'samples/a.wav' },
          { id: 'user:b', name: 'B', mime: 'audio/wav', file: 'samples/missing.wav' },
        ]),
      ),
      'samples/a.wav': new Uint8Array([1, 2, 3]),
    });
    const r = readSongFile(zip, 'song.zip');
    expect(r.raw).toEqual({ name: 'x' });
    expect([...r.userSounds]).toEqual(['user:a']);
    expect(r.zipProblems[0]).toMatch(/missing\.wav/);
  });
  it('explains broken files', () => {
    expect(readSongFile(strToU8('{ nope'), 'a.json').error).toMatch(/isn't valid JSON/);
    expect(readSongFile(zipSync({ 'x.txt': strToU8('hi') }), 'b.zip').error).toMatch(
      /no song\.json/,
    );
  });
});
