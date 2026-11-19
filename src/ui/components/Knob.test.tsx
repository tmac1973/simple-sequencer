import { fireEvent, render, screen } from '@testing-library/react';
import { Knob } from './Knob';

describe('Knob', () => {
  it('drags up to increase with one gesture id, and double-click resets', () => {
    const onChange = vi.fn();
    render(<Knob label="Tone" value={0.5} defaultValue={0.2} onChange={onChange} />);
    const k = screen.getByRole('slider', { name: 'Tone' });
    k.setPointerCapture = () => {};
    fireEvent.pointerDown(k, { clientY: 100, button: 0, pointerId: 1 });
    fireEvent.pointerMove(k, { clientY: 70, pointerId: 1 });
    fireEvent.pointerMove(k, { clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(k, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1]![0]).toBeCloseTo(0.9);
    expect(onChange.mock.calls[0]![1]).toBe(onChange.mock.calls[1]![1]);
    fireEvent.doubleClick(k);
    expect(onChange.mock.calls[2]![0]).toBe(0.2);
  });
  it('responds to arrow keys and clamps', () => {
    const onChange = vi.fn();
    render(<Knob label="Pan" value={0.98} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(onChange.mock.calls[0]![0]).toBe(1);
  });
});
