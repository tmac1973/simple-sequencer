import { test, expect } from '@playwright/test';

test('automate a filter cutoff and see the knob follow it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('row', { name: 'Track Bass' }).click(); // Bass (no effects yet)
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

test('lanes stay lined up with their labels when the track list scrolls by itself', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('row', { name: /^Track Bass/ }).first().click();
  await page.getByRole('tab', { name: 'Automate' }).click();
  for (const knob of ['Volume', 'Pan', 'Tone', 'Space'])
    await page.getByRole('button', { name: `＋ ${knob}`, exact: true }).click();

  // focusing a clipped button makes the browser scroll the track list on its own
  await page.getByRole('button', { name: '＋ Synth' }).focus();
  const list = page.getByRole('complementary', { name: 'Tracks' });
  const label = list.getByText('Space', { exact: true }).first();
  const lane = page.getByLabel(/Bass Space automation$/).first();
  await expect
    .poll(async () => {
      const a = (await label.boundingBox())!;
      const b = (await lane.boundingBox())!;
      return Math.abs(a.y + a.height / 2 - (b.y + b.height / 2));
    })
    .toBeLessThan(2);
});
