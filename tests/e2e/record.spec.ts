import { test, expect, chromium } from '@playwright/test';

test('record from a (fake) microphone and save to My Sounds', async ({ browserName }) => {
  test.skip(browserName !== 'chromium', 'fake media devices are a Chromium feature');
  const browser = await chromium.launch({
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const context = await browser.newContext({
    permissions: ['microphone'],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: '🔍 Change sound' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '● Record' }).click();
  await expect(dialog.getByText('● Recording')).toBeVisible();
  await page.waitForTimeout(1200);
  await dialog.getByRole('button', { name: '■ Stop' }).click();
  await dialog.getByLabel('Recording name').fill('Test take');
  await dialog.getByRole('button', { name: 'Save to My Sounds' }).click();
  await expect(dialog.getByRole('option', { name: /Test take/ })).toBeVisible();
  await browser.close();
});
