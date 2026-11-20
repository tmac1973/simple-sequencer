import type { Page } from '@playwright/test';

/**
 * Does audio time move in this browser? Some CI machines have no sound device, and there
 * Firefox's audio clock stays at 0: nothing plays, so playback timing can't be tested.
 * Call right after a key press or click (browsers only start audio after one).
 */
export async function audioClockRuns(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const c = new AudioContext();
    await c.resume().catch(() => {});
    const t0 = c.currentTime;
    await new Promise((r) => setTimeout(r, 500));
    const moved = c.currentTime > t0;
    await c.close();
    return moved;
  });
}
