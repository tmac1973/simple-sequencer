import { test, expect, type Page } from '@playwright/test';

const tracks = (page: Page) =>
  page.getByRole('complementary', { name: 'Tracks' }).getByRole('row', { name: /^Track / });

async function emptySong(page: Page) {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.getByRole('button', { name: '📁 Songs' }).click();
  await page.getByRole('radio', { name: /^Empty/ }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(tracks(page)).toHaveCount(2);
}

test('pattern ideas: filter, preview, use a groove that fills the kit, then undo', async ({
  page,
}) => {
  await emptySong(page);
  await page.getByRole('button', { name: '💡 Ideas' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: /Drum grooves/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // genre chip and search
  await dialog.getByRole('button', { name: 'House', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'House four-on-the-floor', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Boom-bap (straight)', exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'All', exact: true }).click();
  await dialog.getByLabel('Search ideas').fill('walking');
  await expect(dialog.getByRole('button', { name: 'Walking bass', exact: true })).toBeVisible();
  await dialog.getByLabel('Search ideas').fill('');

  // preview starts and stops
  await dialog.getByRole('button', { name: 'Preview House four-on-the-floor' }).click();
  await expect(dialog.getByRole('button', { name: 'Stop House four-on-the-floor' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '■ Stop' })).toBeVisible();
  await dialog.getByRole('button', { name: '■ Stop' }).click();
  await expect(dialog.getByRole('button', { name: '▶ Preview' })).toBeVisible();

  // the apply bar shows where each part goes
  await expect(dialog.getByText('Kick → Drums')).toBeVisible();
  await expect(dialog.getByText(/Clap → new track/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Use (replace A)' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText(/House four-on-the-floor is in pattern A \(3 new tracks\)/),
  ).toBeVisible();
  await expect(tracks(page)).toHaveCount(5);
  await expect(page.getByRole('spinbutton', { name: 'Tempo' })).toHaveText('123');

  // one undo takes it all back
  await page.getByRole('row', { name: 'Track Drums' }).click();
  await page.keyboard.press('Control+z');
  await expect(tracks(page)).toHaveCount(2);
  await expect(page.getByRole('spinbutton', { name: 'Tempo' })).toHaveText('90');
});

test('pattern ideas: add a bassline as a new pattern on the synth track', async ({ page }) => {
  await emptySong(page);
  await page.getByRole('row', { name: 'Track Bass' }).click();
  await page.getByRole('button', { name: '💡 Ideas' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tab', { name: /Basslines/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog.getByRole('button', { name: 'Walking bass', exact: true }).click();
  await expect(dialog.getByText('Notes → Bass')).toBeVisible();
  await dialog.getByRole('button', { name: '＋ Add as new pattern' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pattern B' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(tracks(page)).toHaveCount(2);
  // "Goes well with" jumps to the paired idea
  await page.getByRole('button', { name: '💡 Ideas' }).click();
  await dialog.getByRole('button', { name: 'Walking bass', exact: true }).click();
  await dialog.getByRole('button', { name: 'Jazz ii–V–I (comping)', exact: true }).click();
  await expect(dialog.getByRole('tab', { name: /Chords/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
