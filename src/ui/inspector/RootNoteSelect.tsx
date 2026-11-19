import { midiName } from '@/model/scale';

/** C2–B5 */
export function RootNoteSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (midi: number) => void;
}) {
  const opts = Array.from({ length: 48 }, (_, i) => 36 + i);
  return (
    <select aria-label="Root note" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {!opts.includes(value) && <option value={value}>{midiName(value)}</option>}
      {opts.map((m) => (
        <option key={m} value={m}>
          {midiName(m)}
        </option>
      ))}
    </select>
  );
}
