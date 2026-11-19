import { test, expect } from '@playwright/test';

for (const name of ['Empty', 'Lo-fi Beat', 'House', 'Hip-hop', 'Trip-hop']) {
  test(`template ${name} loads and plays`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '📁 Songs' }).click();
    await page.getByRole('radio', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
  });
}
