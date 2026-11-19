import { test, expect } from '@playwright/test';

function wavBytes() {
  const sr = 22050;
  const n = Math.floor(sr / 4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = (globalThis as any).Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.round(Math.sin(i / 4) * 12000 * (1 - i / n)), 44 + i * 2);
  return b;
}

test('import a WAV into My Sounds and use it on a track', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '🔍 Change sound' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Import audio files')
    .setInputFiles({ name: 'my-snap.wav', mimeType: 'audio/wav', buffer: wavBytes() });
  await expect(dialog.getByRole('option', { name: /my snap/ })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use this sound' }).click();
  await expect(page.getByLabel('Inspector')).toContainText('my snap');
  // survives a reload (stored in IndexedDB)
  await page.reload();
  await page.getByRole('button', { name: '🔍 Change sound' }).click();
  await page.getByRole('tab', { name: /My Sounds/ }).click();
  await expect(page.getByRole('dialog').getByRole('option', { name: /my snap/ })).toBeVisible();
});
