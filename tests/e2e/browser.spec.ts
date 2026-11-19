import { test, expect } from '@playwright/test';

test('choose a library sound for a track', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Change sound' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('option', { name: /Dusty Kick/ })).toBeVisible();
  await dialog.getByLabel('Search sounds').fill('808 kick');
  await dialog.getByRole('option', { name: /808 Boom/ }).click();
  await dialog.getByRole('button', { name: 'Preview 808 Boom' }).click();
  await dialog.getByRole('button', { name: 'Use this sound' }).click();
  await expect(page.getByLabel('Inspector')).toContainText('808 Boom');
  await page
    .getByRole('button', { name: /About & credits|Simple Sequencer/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('Alexander Holm');
});
