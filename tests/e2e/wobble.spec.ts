import { test, expect, type Page } from '@playwright/test';

async function emptySongOnBass(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Empty/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('row', { name: 'Track Bass' }).click();
  await page.getByRole('tab', { name: 'Automate' }).click();
}

test('wobble (LFO): quick wobble, shape, speed, automated amount, undo, reload, share', async ({
  page,
  browser,
}) => {
  await emptySongOnBass(page);
  await page.getByRole('button', { name: '〰 Wobble bass' }).click();
  const wobble = page.getByLabel('Bass Tone wobble');
  await expect(wobble).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Tracks' })).toContainText('〰 1/8');

  await page.getByLabel('Tone wobble speed').selectOption({ label: '1 bar' });
  await expect(page.getByRole('complementary', { name: 'Tracks' })).toContainText('〰 1 bar');
  await page.getByRole('radio', { name: 'Square (on/off)' }).click();
  await expect(page.getByRole('radio', { name: 'Square (on/off)' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // automate the wobble: fade its amount in
  await page.getByRole('button', { name: '＋ Tone · wobble amount' }).click();
  const amountLane = page.getByLabel('Bass Tone · wobble amount automation');
  await expect(amountLane).toBeVisible();
  const curve = wobble.locator('path').last();
  const before = await curve.getAttribute('d');
  const pt = page.getByRole('button', { name: /^Point at bar 1\.00/ });
  const box = (await pt.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 60, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: /^Point at bar 1\.00: 0%/ })).toBeVisible();
  await expect.poll(() => curve.getAttribute('d')).not.toBe(before);

  // undo the drag
  await page.getByRole('row', { name: 'Track Bass' }).click();
  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: /^Point at bar 1\.00: 100%/ })).toBeVisible();

  // saved: survives a reload
  await page.waitForTimeout(2000);
  await page.reload();
  await expect(page.getByLabel('Bass Tone wobble')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Tracks' })).toContainText('〰 1 bar');

  // and travels in a share link
  await page.getByRole('button', { name: '🔗 Share' }).click();
  const url = await page.getByLabel('Share link').inputValue();
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await other.goto(url);
  await other.getByRole('button', { name: 'Open song' }).click();
  await expect(other.getByLabel('Bass Tone wobble')).toBeVisible();
  await expect(other.getByLabel('Bass Tone · wobble amount automation')).toBeVisible();
  await ctx.close();
});

test('switching a drawn lane to Wobble and back keeps the drawn points', async ({ page }) => {
  await emptySongOnBass(page);
  await page.getByRole('button', { name: '＋ Pan' }).click();
  await expect(page.getByLabel('Bass Pan automation')).toBeVisible();
  await page.getByRole('radio', { name: '〰️ Wobble' }).click();
  await expect(page.getByLabel('Bass Pan wobble')).toBeVisible();
  await page.getByRole('radio', { name: '✏️ Draw' }).click();
  await expect(page.getByLabel('Bass Pan automation')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Point at bar/ })).toHaveCount(2);
});
