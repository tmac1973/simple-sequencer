import { test } from '@playwright/test';

test('capture README screenshot', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || !process.env.SCREENSHOT, 'run with SCREENSHOT=1');
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'docs/screenshot.png' });
});
