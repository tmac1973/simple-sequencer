import { test, expect } from '@playwright/test';

test('stress song (16 tracks × 128 bars, 3 effects + 1 lane each) plays smoothly', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'long-task timing is a Chromium API');
  test.skip(!process.env.PERF, 'timing-sensitive: run alone with `npm run e2e:perf`');
  test.setTimeout(90_000);
  await page.goto('/?debug');
  await page.waitForFunction(() => '__ss' in window);
  await page.evaluate(() =>
    (window as unknown as { __ss: { loadStress(): void } }).__ss.loadStress(),
  );
  await expect(page.getByLabel('Song name')).toHaveValue('Stress test');
  await page.getByRole('radio', { name: 'Song' }).click();
  await page.evaluate(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => w.__long.push(e.duration)),
    ).observe({ type: 'longtask', buffered: false });
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500); // let samples load and effects warm up
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
  // interact while playing: toggle steps and measure response time
  await page.evaluate(() => ((window as unknown as { __events: number[] }).__events = []));
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: /^Step 2 / }).click();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  const times = await page.evaluate(() => (window as unknown as { __events: number[] }).__events);
  await page.keyboard.press('Space');
  const worst = Math.max(0, ...long);
  console.log(
    `PERF long tasks: ${long.length}, worst ${Math.round(worst)} ms; interactions over 16 ms: ${times.map(Math.round).join(', ') || 'none'}`,
  );
  expect(worst).toBeLessThan(50);
  expect(Math.max(0, ...times)).toBeLessThan(100);
});
