import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';

enablePatches();

export const HISTORY_LIMIT = 200;

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  gestureId?: string;
}

export interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const emptyHistory = (): HistoryState => ({ past: [], future: [] });

/** Apply a recipe and record it. Same-gesture entries in a row are merged into one undo step. */
export function record<T>(
  state: T,
  history: HistoryState,
  label: string,
  recipe: (draft: Draft<T>) => void,
  gestureId?: string,
): { state: T; history: HistoryState } | null {
  const [next, patches, inverse] = produceWithPatches(state, recipe);
  if (patches.length === 0) return null;
  const past = history.past.slice();
  const last = past[past.length - 1];
  if (gestureId && last && last.gestureId === gestureId) {
    past[past.length - 1] = {
      ...last,
      patches: [...last.patches, ...patches],
      inverse: [...inverse, ...last.inverse],
    };
  } else {
    past.push({ label, patches, inverse, gestureId });
    if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  }
  return { state: next as T, history: { past, future: [] } };
}

export function undo<T>(
  state: T,
  history: HistoryState,
): { state: T; history: HistoryState } | null {
  const entry = history.past[history.past.length - 1];
  if (!entry) return null;
  return {
    state: applyPatches(state as object, entry.inverse) as T,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, { ...entry, gestureId: undefined }],
    },
  };
}

export function redo<T>(
  state: T,
  history: HistoryState,
): { state: T; history: HistoryState } | null {
  const entry = history.future[history.future.length - 1];
  if (!entry) return null;
  return {
    state: applyPatches(state as object, entry.patches) as T,
    history: { past: [...history.past, entry], future: history.future.slice(0, -1) },
  };
}
