/** Knob value mappings shared by the inspector. */
export const pitchToKnob = (st: number) => (st + 24) / 48;
export const knobToPitch = (v: number) => Math.round(v * 48 - 24);
export const fmtSemis = (st: number) => (st === 0 ? '0 st' : `${st > 0 ? '+' : ''}${st} st`);
export const panToKnob = (p: number) => (p + 1) / 2;
export const knobToPan = (v: number) => Math.round((v * 2 - 1) * 100) / 100;
export const fmtPan = (p: number) =>
  Math.abs(p) < 0.02
    ? 'Center'
    : p < 0
      ? `${Math.round(-p * 100)}% L`
      : `${Math.round(p * 100)}% R`;
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtTone = (v: number) =>
  v > 0.97 ? 'Open' : v < 0.35 ? 'Darker' : `${Math.round(v * 100)}%`;
