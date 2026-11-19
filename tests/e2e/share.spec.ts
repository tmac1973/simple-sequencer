import { test, expect, type Page } from '@playwright/test';

async function freshEmptySong(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Empty/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
}

test('share a song as a link and open it in another browser', async ({ page, browser }) => {
  await freshEmptySong(page);
  const name = page.getByLabel('Song name');
  await name.fill('Linked Tune');
  await name.press('Enter');
  await page.getByRole('spinbutton', { name: 'Tempo' }).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('133');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '🔗 Share' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Nothing is uploaded');
  await expect(dialog).not.toContainText('your own sounds');
  const url = await dialog.getByLabel('Share link').inputValue();
  expect(url).toMatch(/#song=[A-Za-z0-9_-]+$/);
  await dialog.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByText(/Copied!|Press Ctrl\+C/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();

  // a different person: a brand-new browser profile
  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await other.goto(url);
  const ask = other.getByRole('dialog', { name: 'Someone shared a song with you' });
  await expect(ask).toContainText('Linked Tune');
  await expect(ask).toContainText('133 BPM');
  await expect(other).not.toHaveURL(/#song=/);
  await ask.getByRole('button', { name: 'Open song' }).click();
  await expect(other.getByLabel('Song name')).toHaveValue('Linked Tune');
  await expect(other.getByRole('spinbutton', { name: 'Tempo' })).toHaveText('133');
  // it was saved: still there after a reload, and the reload doesn't ask again
  await other.waitForTimeout(2000);
  await other.reload();
  await expect(other.getByLabel('Song name')).toHaveValue('Linked Tune');
  await expect(other.getByRole('dialog')).toHaveCount(0);
  await ctx.close();
});

test('a broken share link explains itself', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/#song=not-a-real-song');
  await expect(page.getByText(/broken or incomplete/)).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('insert, duplicate and delete bars from the ruler', async ({ page }) => {
  await freshEmptySong(page);
  const end = page.getByRole('slider', { name: 'Song end' });
  await expect(end).toHaveAttribute('aria-valuenow', '8');
  await page.getByLabel('Bar 1', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Insert 4 empty bars before bar 1/ }).click();
  await expect(end).toHaveAttribute('aria-valuenow', '12');
  // the drums moved: bar 1 is empty now, bar 5 has them
  await expect(page.getByLabel('Drums timeline')).toBeVisible();
  await page.getByLabel('Bar 5', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Duplicate bars 5–8/ }).click();
  await expect(end).toHaveAttribute('aria-valuenow', '16');
  await page.getByLabel('Bar 1', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Delete bars 1–4/ }).click();
  await expect(end).toHaveAttribute('aria-valuenow', '12');
  await page.keyboard.press('Control+z');
  await expect(end).toHaveAttribute('aria-valuenow', '16');
});
