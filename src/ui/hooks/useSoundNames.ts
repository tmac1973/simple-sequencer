import { useEffect, useReducer } from 'react';
import { onSoundNamesChanged } from '@/library/soundNames';

/** Re-render when sound name sources change (e.g. the library manifest loads). */
export function useSoundNamesVersion() {
  const [v, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onSoundNamesChanged(bump), []);
  return v;
}
