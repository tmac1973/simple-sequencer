import { createPattern, createSampleTrack, createSong } from '@/model/factories';
import type { Song } from '@/model/types';

/** A small hard-coded song using generated test sounds (judge engine timing by ear). */
export function createDevSong(): Song {
  const kick = createSampleTrack({ name: 'Kick', sampleId: 'dev:kick' });
  kick.patterns = [
    createPattern({ name: 'A', steps: [0, 8].map((index) => ({ index, velocity: 1 })) }),
    createPattern({
      name: 'B',
      steps: [0, 3, 8, 10, 14].map((index) => ({ index, velocity: 0.9 })),
    }),
  ];
  kick.blocks = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => ({
    id: `k${b}`,
    patternId: kick.patterns[b % 4 === 3 ? 1 : 0]!.id,
    startBar: b,
  }));
  const snare = createSampleTrack({ name: 'Snare', sampleId: 'dev:snare' }, [kick]);
  snare.patterns[0]!.steps = [4, 12].map((index) => ({ index, velocity: 0.9 }));
  snare.blocks = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => ({
    id: `s${b}`,
    patternId: snare.patterns[0]!.id,
    startBar: b,
  }));
  const hat = createSampleTrack({ name: 'Hat', sampleId: 'dev:hat' }, [kick, snare]);
  hat.patterns[0]!.steps = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    velocity: i % 2 ? 0.45 : 0.8,
  }));
  hat.blocks = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => ({
    id: `h${b}`,
    patternId: hat.patterns[0]!.id,
    startBar: b,
  }));
  return createSong({
    name: 'Dev song',
    bpm: 96,
    swing: 0.25,
    lengthBars: 8,
    tracks: [kick, snare, hat],
  });
}
