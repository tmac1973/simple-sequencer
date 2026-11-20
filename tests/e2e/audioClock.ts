import type { Page } from '@playwright/test';

/**
 * Does audio time move in this browser? Some CI machines have no sound device, and there
 * Firefox's audio can't start (resume() never settles): nothing plays, so playback timing
 * can't be tested.
 * Call right after a key press or click (browsers only start audio after one).
 */
export async function audioClockRuns(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const c = new AudioContext();
    // without a sound device, resume() never settles
    await Promise.race([c.resume().catch(() => {}), wait(1000)]);
    const t0 = c.currentTime;
    await wait(500);
    const moved = c.currentTime > t0;
    void c.close().catch(() => {});
    return moved;
  });
}
