import { test, expect } from '@playwright/test';
import { audioClockRuns } from './audioClock';

test('loop a section: drag the ruler, playback stays inside, toggle, export option', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  // drag from bar 3 to bar 4 on the ruler
  const b3 = (await page.getByLabel('Bar 3', { exact: true }).boundingBox())!;
  const b4 = (await page.getByLabel('Bar 4', { exact: true }).boundingBox())!;
  await page.mouse.move(b3.x + 10, b3.y + 8);
  await page.mouse.down();
  await page.mouse.move(b4.x + 30, b4.y + 8, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByLabel('Loop bars 3–4')).toBeVisible();
  const loopBtn = page.getByRole('button', { name: 'Loop on, bars 3–4' });
  await expect(loopBtn).toHaveAttribute('aria-pressed', 'true');

  // play fast: the playhead stays inside bars 3–4 (64 px per bar) for more than a loop
  const tempo = page.getByLabel('Tempo');
  await tempo.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.type('220');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  const audio = await audioClockRuns(page);
  const head = page.locator('[class*="playhead"]').first();
  const seen: number[] = [];
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(150);
    const left = await head.evaluate((el) => parseFloat((el as HTMLElement).style.left));
    if ((await head.evaluate((el) => (el as HTMLElement).style.display)) !== 'none' && left > 0)
      seen.push(left);
  }
  await page.keyboard.press('Space');
  if (audio) {
    expect(seen.length).toBeGreaterThan(10);
    for (const x of seen) {
      expect(x).toBeGreaterThanOrEqual(2 * 64 - 1);
      expect(x).toBeLessThanOrEqual(4 * 64 + 1);
    }
    // it wrapped around at least once
    expect(seen.some((x, i) => i > 0 && x < seen[i - 1]!)).toBe(true);
  } else {
    test.info().annotations.push({ type: 'skipped part', description: 'no running audio clock' });
  }

  // the button turns it off without forgetting it
  await loopBtn.click();
  await expect(page.getByRole('button', { name: 'Loop', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await expect(page.getByLabel('Loop bars 3–4')).toBeVisible();

  // right-click menu: loop 8 bars from bar 1
  await page.getByLabel('Bar 1', { exact: true }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /Loop bars 1–8/ }).click();
  await expect(page.getByLabel('Loop bars 1–8')).toBeVisible();

  // export offers the song loop
  await page
    .getByRole('button', { name: /Export/ })
    .first()
    .click();
  await expect(page.getByRole('radio', { name: /Just the song loop/ })).toContainText('Bars 1–8');
});
