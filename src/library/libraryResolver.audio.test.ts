import { describe, it, expect } from 'vitest';
import { decodeAudio } from '@/audio/decode';

describe('bundled FLAC', () => {
  it('decodes in the browser', async () => {
    const res = await fetch('/samples/dusty/dusty-kick.flac');
    expect(res.ok).toBe(true);
    const buf = await decodeAudio(await res.arrayBuffer());
    expect(buf.numberOfChannels).toBe(1);
    expect(buf.duration).toBeGreaterThan(0.05);
  });
});
