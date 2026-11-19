import { test, expect } from '@playwright/test';

test('add a synth track, stamp a chord, change key, play', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '＋ Synth' }).click();
  await expect(page.getByLabel('Pattern editor')).toContainText('Piano roll');
  await page.getByRole('radio', { name: 'Triad' }).click();
  const grid = page.getByLabel('Piano roll grid');
  const box = (await grid.boundingBox())!;
  await page.mouse.click(box.x + 10, box.y + box.height - 9);
  await expect(page.getByRole('button', { name: /^Note/ })).toHaveCount(3);
  await page.getByLabel('Key', { exact: true }).selectOption({ label: 'A' });
  await expect(page.getByRole('button', { name: /^Note A/ })).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await page.keyboard.press('Space');
});
