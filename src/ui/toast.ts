import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'info' | 'error';
  message: string;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }): number;
  dismiss(id: number): void;
}

let next = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(t) {
    const id = next++;
    const toast: Toast = { durationMs: 5000, ...t, id };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    setTimeout(() => useToasts.getState().dismiss(id), toast.durationMs);
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
  },
}));

export function toast(t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }): number {
  return useToasts.getState().push(t);
}

export function toastError(e: unknown) {
  toast({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
}
