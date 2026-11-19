import { test, expect } from '@playwright/test';

test('edits survive a reload, and a song file round-trips', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('● Saved')).toBeVisible({ timeout: 10_000 });
  const name = page.getByLabel('Song name');
  await name.fill('My Saved Song');
  await name.press('Enter');
  await page.getByRole('button', { name: 'Faster' }).click();
  await expect(page.getByText('● Saved')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel('Song name')).toHaveValue('My Saved Song');
  await expect(page.getByRole('spinbutton', { name: 'Tempo' })).toHaveText('85');

  // download the song file from the library
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('button', { name: 'More options for My Saved Song' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: /Download song file/ }).click(),
  ]);
  // WebKit's download names use _ for spaces
  expect(download.suggestedFilename()).toMatch(/^My[ _]Saved[ _]Song\.json$/);
  const path = await download.path();

  // start another song, then re-open the file
  await page.getByRole('radio', { name: /^House/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Song name')).toHaveValue('House Groove');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByLabel('Open song file').setInputFiles(path);
  await expect(page.getByLabel('Song name')).toHaveValue('My Saved Song');
  // both songs are in the library now (plus the imported copy)
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await expect(page.getByRole('dialog').getByText('House Groove')).toBeVisible();
});
