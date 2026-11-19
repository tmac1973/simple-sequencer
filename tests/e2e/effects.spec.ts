import { test, expect } from '@playwright/test';

test('add and reorder effects on a track while playing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: /Effects/ }).click();
  for (const name of ['Filter', 'Reverb']) {
    await page.getByRole('button', { name: '＋ Add effect' }).click();
    await page.getByRole('menuitem', { name: new RegExp(name) }).click();
  }
  await expect(page.getByLabel('Filter effect')).toBeVisible();
  await expect(page.getByLabel('Reverb effect')).toBeVisible();
  await page.keyboard.press('Space');
  const grip = page.getByLabel('Reorder Reverb');
  const target = page.getByLabel('Filter effect');
  const g = (await grip.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(g.x + 4, g.y + 4);
  await page.mouse.down();
  await page.mouse.move(g.x + 4, t.y + 5, { steps: 10 });
  await page.mouse.up();
  const cards = page.locator('[aria-label$=" effect"]');
  await expect(cards.first()).toHaveAttribute('aria-label', 'Reverb effect');
  await page.getByRole('switch', { name: 'Filter on/off' }).click();
  await page.keyboard.press('Space');
  await expect(page.getByRole('tab', { name: /Effects/ })).toContainText('2');
});
