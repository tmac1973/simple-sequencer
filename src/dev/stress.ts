import {
  createFxSlot,
  createLane,
  createPattern,
  createSampleTrack,
  createSong,
  createSynthTrack,
} from '@/model/factories';
import { defaultParams } from '@/audio/effects/registry';
import type { FxType, Song, Track } from '@/model/types';

/** QA helper: the heaviest supported song (16 tracks × 128 bars, 3 effects + 1 lane each). */
export function buildStressSong(): Song {
  const tracks: Track[] = [];
  const fxSets: FxType[][] = [
    ['filter', 'compressor', 'reverb'],
    ['eq', 'delay', 'chorus'],
    ['distortion', 'filter', 'bitcrush'],
  ];
  const drums = [
    'lib:dusty-kick',
    'lib:dusty-snare',
    'lib:dusty-hat',
    'lib:club-clap',
    'lib:808-rim',
    'lib:club-perc-shaker',
    'lib:808-tick',
    'lib:dusty-tom-lo',
  ];
  for (let i = 0; i < 16; i++) {
    const isSynth = i >= 8;
    const p = createPattern({
      name: 'A',
      lengthBars: 2,
      steps: isSynth
        ? []
        : Array.from({ length: 32 }, (_, k) => k)
            .filter((k) => (k * (i + 3)) % 5 < 2)
            .map((index) => ({ index, velocity: 0.7 })),
      notes: isSynth
        ? Array.from({ length: 8 }, (_, k) => ({
            start: k * 4,
            length: 3,
            degree: (k * (i - 5)) % 7,
            velocity: 0.7,
          }))
        : [],
    });
    const t = isSynth
      ? createSynthTrack(
          {
            name: `Synth ${i - 7}`,
            presetId: [
              'warm-bass',
              'dusty-keys',
              'soft-pluck',
              'soft-pad',
              'bright-lead',
              'bell',
              'electric-piano',
              'retro-square',
            ][i - 8],
            patterns: [p],
            volumeDb: -12,
          },
          tracks,
        )
      : createSampleTrack(
          { name: `Drum ${i + 1}`, sampleId: drums[i]!, patterns: [p], volumeDb: -10 },
          tracks,
        );
    t.blocks = Array.from({ length: 64 }, (_, k) => ({
      id: `${i}-${k}`,
      patternId: p.id,
      startBar: k * 2,
    }));
    t.fx = fxSets[i % 3]!.map((type) => createFxSlot(type, defaultParams(type)));
    const fx0 = t.fx[0]!;
    t.automation = [
      createLane(
        { kind: 'fx', fxId: fx0.id, param: Object.keys(fx0.params)[0]! },
        Array.from({ length: 17 }, (_, k) => ({ bar: k * 8, value: k % 2 ? 0.8 : 0.3 })),
      ),
    ];
    tracks.push(t);
  }
  return createSong({ name: 'Stress test', bpm: 128, lengthBars: 128, tracks });
}
