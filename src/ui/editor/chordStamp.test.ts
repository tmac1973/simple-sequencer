import { chordDegrees } from './chordStamp';
import { degreeToMidi } from '@/model/scale';

describe('chord stamp', () => {
  it('stacks every other scale degree', () => {
    expect(chordDegrees(0, 'off')).toEqual([0]);
    expect(chordDegrees(3, 'triad')).toEqual([3, 5, 7]);
    expect(chordDegrees(1, 'seventh')).toEqual([1, 3, 5, 7]);
  });
  it('C minor triad on degree 0 is C, E♭, G', () => {
    const key = { root: 0, scale: 'minor' as const };
    expect(chordDegrees(0, 'triad').map((d) => degreeToMidi(d, key) % 12)).toEqual([0, 3, 7]);
  });
});
