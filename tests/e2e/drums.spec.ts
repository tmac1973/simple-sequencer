import { test, expect } from '@playwright/test';

test('build a drum pattern, paint it, play it and undo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Drum/Sample' }).click();
  await expect(page.getByLabel('Pattern editor')).toContainText(/Steps/);
  // toggle steps 1 and 9
  await page.getByRole('button', { name: 'Step 1 off' }).click();
  await page.getByRole('button', { name: 'Step 9 off' }).click();
  await expect(page.getByRole('button', { name: /Step 9 on/ })).toBeVisible();
  // paint 4 bars on the new track's timeline row
  const row = page.getByLabel('Drum timeline', { exact: true });
  await row.scrollIntoViewIfNeeded();
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 64 * 3 + 20, box.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect(row.locator('div').filter({ hasText: 'A' }).first()).toBeVisible();
  // play: playhead becomes visible and moves
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  // undo removes the painted blocks
  await page.keyboard.press('Control+z');
  await expect(row.locator('div').filter({ hasText: 'A' })).toHaveCount(0);
});
