import { test, expect } from '@playwright/test';

const lastBar = (page: import('@playwright/test').Page) =>
  page.getByRole('slider', { name: 'Song end' });

test('shorten a song: trim, −4 bars and dragging the end', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Empty/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  // Empty template: 8 bars, drums painted in bars 1–4
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '8');
  await page.getByRole('button', { name: '⇤ Trim' }).click();
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '4');
  // can't cut off blocks
  await expect(page.getByRole('button', { name: 'Remove 4 bars' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add 4 bars' }).click();
  await page.getByRole('button', { name: 'Add 4 bars' }).click();
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '12');
  await page.getByRole('button', { name: 'Remove 4 bars' }).click();
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '8');
  // drag the end handle 2 bars left
  const h = (await lastBar(page).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - 128, h.y + h.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '6');
  // and it can't be dragged past the last block
  const h2 = (await lastBar(page).boundingBox())!;
  await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
  await page.mouse.down();
  await page.mouse.move(h2.x - 600, h2.y + h2.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '4');
  // undo brings the length back
  await page.keyboard.press('Control+z');
  await expect(lastBar(page)).toHaveAttribute('aria-valuenow', '5');
});
