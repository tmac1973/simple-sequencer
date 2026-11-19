import { createSampleTrack } from '@/model/factories';
import type { Song } from '@/model/types';
import { buildEmpty } from '@/templates/empty';
import { buildHiphop } from '@/templates/hiphop';
import { buildHouse } from '@/templates/house';
import { buildLofi } from '@/templates/lofi';
import { buildTriphop } from '@/templates/triphop';
import { buildStressSong } from '@/dev/stress';
import { decodeShare, encodeShare, ownSoundTracks, shareDataFromHash, shareUrl } from './shareLink';

/** A song with ids swapped for stable names, so two copies can be compared. */
function normal(song: Song) {
  return {
    ...song,
    id: 'x',
    createdAt: 0,
    updatedAt: 0,
    tracks: song.tracks.map((t) => {
      const pname = (id: string) => t.patterns.find((p) => p.id === id)?.name;
      const fxIndex = (id: string) => t.fx.findIndex((f) => f.id === id);
      return {
        ...t,
        id: 'x',
        patterns: t.patterns.map((p) => ({ ...p, id: p.name })),
        blocks: t.blocks.map((b) => ({ startBar: b.startBar, pattern: pname(b.patternId) })),
        fx: t.fx.map((f) => ({ ...f, id: 'x' })),
        automation: t.automation.map((l) => ({
          ...l,
          id: 'x',
          target: l.target.kind === 'fx' ? { ...l.target, fxId: fxIndex(l.target.fxId) } : l.target,
        })),
      };
    }),
  };
}

describe('share links', () => {
  it.each([
    ['Empty', buildEmpty],
    ['Lo-fi', buildLofi],
    ['House', buildHouse],
    ['Hip-hop', buildHiphop],
    ['Trip-hop', buildTriphop],
  ])('%s survives a round trip and makes a short link', (_, build) => {
    const song = build();
    const data = encodeShare(song);
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(data.length).toBeLessThan(2600);
    const back = decodeShare(data);
    expect(back.id).not.toBe(song.id);
    expect(normal(back)).toEqual(normal(song));
  });

  it('handles a huge song', () => {
    const song = buildStressSong();
    const data = encodeShare(song);
    expect(data.length).toBeLessThan(20000);
    expect(decodeShare(data).tracks).toHaveLength(song.tracks.length);
  });

  it('swaps your own sounds for built-in ones', () => {
    const song = buildEmpty();
    song.tracks.push(createSampleTrack({ name: 'My Clap', sampleId: 'user:abc' }));
    song.tracks.push(
      createSampleTrack({ name: 'Voice', sampleId: 'rec:1', melodic: true, rootMidi: 64 }),
    );
    expect(ownSoundTracks(song).map((t) => t.name)).toEqual(['My Clap', 'Voice']);
    const back = decodeShare(encodeShare(song));
    expect(back.tracks[2]!.sample!.sampleId).toBe('lib:dusty-snap');
    expect(back.tracks[3]!.sample).toMatchObject({ sampleId: 'lib:piano-c4', rootMidi: 60 });
    expect(ownSoundTracks(back)).toEqual([]);
  });

  it('rejects broken links with a friendly message', () => {
    const data = encodeShare(buildLofi());
    expect(() => decodeShare(data.slice(0, data.length / 2))).toThrow(/broken or incomplete/);
    expect(() => decodeShare('hello')).toThrow(/broken or incomplete/);
  });

  it('builds and reads the URL fragment', () => {
    const url = shareUrl(buildLofi(), 'https://example.test/app/?debug#old');
    expect(url).toMatch(/^https:\/\/example\.test\/app\/#song=/);
    const data = shareDataFromHash(new URL(url).hash)!;
    expect(decodeShare(data).name).toBe('Lo-fi Beat');
    expect(shareDataFromHash('#other')).toBeNull();
  });
});
