import { test, expect, type Page } from '@playwright/test';
import { audioClockRuns } from './audioClock';

async function emptySong(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Empty/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
}

test('play the computer keyboard, record a take, undo it', async ({ page }) => {
  await emptySong(page);
  await page.getByRole('row', { name: 'Track Bass' }).click();
  await expect(page.getByLabel('Pattern editor')).toContainText('play notes');
  const notes = page.getByRole('button', { name: /^Note / });
  await expect(notes).toHaveCount(0);

  // holding D lights up its row; Z/X change the octave
  await page.keyboard.down('d');
  await expect(page.locator('[class*="lit"]').first()).toBeVisible();
  await page.keyboard.up('d');
  await expect(page.locator('[class*="lit"]')).toHaveCount(0);
  await page.keyboard.press('x');
  await expect(
    page.getByRole('button', { name: 'Keys: notes from your computer keyboard' }),
  ).toContainText('+1');
  await page.keyboard.press('z');

  // recording follows the audio clock; without one (some CI machines) stop here
  if (!(await audioClockRuns(page))) {
    test.info().annotations.push({ type: 'skipped part', description: 'no running audio clock' });
    return;
  }

  // record without a count-in: play three notes while the pattern loops
  await page.getByRole('button', { name: 'Recording settings' }).click();
  await page
    .getByRole('dialog', { name: 'Recording settings' })
    .getByRole('radio', { name: 'Off' })
    .click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Record into this pattern' }).click();
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
  await page.waitForTimeout(400);
  for (const k of ['a', 'f', 'h']) {
    await page.keyboard.down(k);
    await page.waitForTimeout(180);
    await page.keyboard.up(k);
    await page.waitForTimeout(150);
  }
  await expect(page.getByRole('button', { name: 'Stop recording' })).toContainText('· 3');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Record into this pattern' })).toBeVisible();
  await expect(notes).toHaveCount(3);

  // one undo removes the whole take
  await page.keyboard.press('Control+z');
  await expect(notes).toHaveCount(0);

  // 🎹 Keys off: letters do nothing
  await page.getByRole('button', { name: 'Keys: notes from your computer keyboard' }).click();
  await page.keyboard.down('d');
  await expect(page.locator('[class*="lit"]')).toHaveCount(0);
  await page.keyboard.up('d');
});

test('step chance: drag sets how often a step plays', async ({ page }) => {
  await emptySong(page);
  await page.getByRole('row', { name: 'Track Drums' }).click();
  await page.getByRole('button', { name: 'Step 2 off' }).click();
  await page.getByRole('radio', { name: '🎲 Chance' }).click();
  const pad = page.getByRole('button', { name: /^Step 2 on/ });
  await expect(pad).toContainText('100%');
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up();
  await expect(pad).toHaveAccessibleName(/plays 50% of the time/);
  await page.getByRole('radio', { name: 'Loudness' }).click();
  await expect(pad).toContainText('🎲');
});
