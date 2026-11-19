import { test, expect } from '@playwright/test';

/** The whole primary flow, end to end, as a first-time user would do it. */
test('full flow: template → edit → synth → effect → paint → automate → export → reload', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/');
  // first-run tip appears and doesn't block anything
  await expect(page.getByRole('note', { name: 'Tip' })).toContainText('Press Space');

  // choose Hip-hop
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Hip-hop/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Song name')).toHaveValue('Hip-hop Beat');

  // quick double Space must end up stopped
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  // toggle a kick step
  await page.getByRole('button', { name: 'Step 5 off' }).click();
  await expect(page.getByRole('button', { name: /Step 5 on/ })).toBeVisible();

  // add a synth track and stamp a chord
  await page.getByRole('button', { name: '＋ Synth' }).click();
  await page.getByRole('radio', { name: 'Triad' }).click();
  const grid = page.getByLabel('Piano roll grid');
  const g = (await grid.boundingBox())!;
  await page.mouse.click(g.x + 12, g.y + g.height - 9);
  await expect(page.getByRole('button', { name: /^Note/ })).toHaveCount(3);

  // add reverb
  await page.getByRole('tab', { name: /Effects/ }).click();
  await page.getByRole('button', { name: '＋ Add effect' }).click();
  await page.getByRole('menuitem', { name: /Reverb/ }).click();
  await expect(page.getByLabel('Reverb effect')).toBeVisible();

  // paint the new synth's pattern on the timeline
  const row = page.getByLabel('Bass timeline', { exact: true }).last();
  await row.scrollIntoViewIfNeeded();
  const r = (await row.boundingBox())!;
  await page.mouse.click(r.x + 64 * 2 + 10, r.y + 20);

  // a volume automation point
  await page.getByRole('tab', { name: 'Automate' }).click();
  await page.getByRole('button', { name: '＋ Volume' }).click();
  const lane = page.getByLabel(/Bass Volume automation/).last();
  await lane.scrollIntoViewIfNeeded();
  const l = (await lane.boundingBox())!;
  await page.mouse.click(l.x + 64 * 4, l.y + 40);
  await expect(lane.getByRole('button', { name: /Point at bar/ })).toHaveCount(3);

  // export the loop as WAV
  await page.getByRole('button', { name: '⤓ Export' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /^WAV/ }).click();
  await dialog.getByRole('radio', { name: /Current pattern loop/ }).click();
  await dialog.getByLabel('Repeats').selectOption('1');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    dialog.getByRole('button', { name: 'Export WAV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Hip-hop[ _]Beat[ _]-[ _].*\.wav$/);
  await dialog.getByRole('button', { name: 'Close' }).last().click();

  // reload: the song is restored with the edits
  await expect(page.getByText('● Saved')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel('Song name')).toHaveValue('Hip-hop Beat');
  await expect(page.locator('[data-track-row]')).toHaveCount(8);
});
