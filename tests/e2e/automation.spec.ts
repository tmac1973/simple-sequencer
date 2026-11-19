import { test, expect } from '@playwright/test';

test('automate a filter cutoff and see the knob follow it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('6'); // Bass (no effects yet)
  await page.getByRole('tab', { name: /Effects/ }).click();
  await page.getByRole('button', { name: '＋ Add effect' }).click();
  await page.getByRole('menuitem', { name: /Filter/ }).click();
  await page.getByRole('tab', { name: 'Automate' }).click();
  await page.getByRole('button', { name: '＋ Filter · Cutoff' }).click();
  const lane = page.getByLabel(/Bass Filter · Cutoff automation/);
  await expect(lane).toBeVisible();
  const box = (await lane.boundingBox())!;
  await page.mouse.click(box.x + 64 * 2, box.y + 8);
  await expect(lane.getByRole('button', { name: /Point at bar/ })).toHaveCount(3);
  await page.getByRole('tab', { name: /Effects/ }).click();
  await expect(page.getByRole('slider', { name: 'Cutoff' })).toHaveAttribute(
    'data-tip',
    /automated/,
  );
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
});
