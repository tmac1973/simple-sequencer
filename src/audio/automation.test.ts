vi.mock('tone', () => ({}));
import { scheduleAutomation } from './automation';
import { createLane, createSampleTrack, createSong } from '@/model/factories';
import type { GraphSet } from './engine';

function mockParam() {
  const calls: [string, number, number][] = [];
  return {
    calls,
    setValueAtTime: (v: number, t: number) => calls.push(['set', v, t]),
    linearRampToValueAtTime: (v: number, t: number) => calls.push(['ramp', v, t]),
    exponentialRampToValueAtTime: (v: number, t: number) => calls.push(['exp', v, t]),
    cancelAndHoldAtTime: (t: number) => calls.push(['cancel', 0, t]),
  };
}

describe('scheduleAutomation', () => {
  it('jumps on the first beat, ramps through corner points and to the beat end', () => {
    const t = createSampleTrack();
    t.automation = [
      createLane({ kind: 'track', param: 'pan' }, [
        { bar: 0, value: 0.5 },
        { bar: 0.125, value: 1 }, // half way through beat 0
        { bar: 1, value: 0 },
      ]),
    ];
    const song = createSong({ tracks: [t], bpm: 120 });
    const pan = mockParam();
    const graphs = {
      tracks: new Map([[t.id, { channel: { pan, volume: mockParam() } }]]),
      synths: new Map(),
      sampleTone: new Map(),
      fx: new Map(),
    } as unknown as GraphSet;
    scheduleAutomation(graphs, song, 0, 10, 0.5, true);
    // pan maps 0–1 → -1…1
    expect(pan.calls[0]).toEqual(['cancel', 0, 10]);
    expect(pan.calls[1]).toEqual(['set', 0, 10]);
    expect(pan.calls[2]![0]).toBe('ramp');
    expect(pan.calls[2]![1]).toBeCloseTo(1);
    expect(pan.calls[2]![2]).toBeCloseTo(10.25);
    const last = pan.calls[pan.calls.length - 1]!;
    expect(last[2]).toBeCloseTo(10.5);
    expect(last[1]).toBeCloseTo((1 + (0 - 1) * ((0.25 - 0.125) / 0.875)) * 2 - 1, 3);
  });
  it('does not jump on continuing beats', () => {
    const t = createSampleTrack();
    t.automation = [createLane({ kind: 'track', param: 'volume' }, [{ bar: 0, value: 0.7 }])];
    const vol = mockParam();
    const graphs = {
      tracks: new Map([[t.id, { channel: { pan: mockParam(), volume: vol } }]]),
      synths: new Map(),
      sampleTone: new Map(),
      fx: new Map(),
    } as unknown as GraphSet;
    scheduleAutomation(graphs, createSong({ tracks: [t] }), 5, 3, 0.5, false);
    expect(vol.calls.map((c) => c[0])).toEqual(['ramp']);
  });
});
