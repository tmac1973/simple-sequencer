import { test, expect } from '@playwright/test';

test('export the whole song as MP3', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: '⤓ Export' }).click();
  const dialog = page.getByRole('dialog');
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 110_000 }),
    dialog.getByRole('button', { name: 'Export MP3' }).click(),
  ]);
  const ms = Date.now() - t0;
  console.log(`FULL-SONG-EXPORT ${ms} ms`);
  expect(download.suggestedFilename()).toMatch(/\.mp3$/);
  // the UI stays responsive while exporting
  await expect(dialog.getByRole('status')).toContainText('Done');
});
