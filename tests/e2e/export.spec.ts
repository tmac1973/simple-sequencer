import { test, expect } from '@playwright/test';

for (const fmt of ['WAV', 'MP3']) {
  test(`export the pattern loop as ${fmt}`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '⤓ Export' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: new RegExp(`^${fmt}`) }).click();
    await dialog.getByRole('radio', { name: /Current pattern loop/ }).click();
    await dialog.getByLabel('Repeats').selectOption('1');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      dialog.getByRole('button', { name: `Export ${fmt}` }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^Lo-fi[ _]Beat[ _]-[ _]\\d{4}-\\d{2}-\\d{2}\\.${fmt.toLowerCase()}$`),
    );
    const path = await download.path();
    const fs = await import('node:fs');
    const size = fs.statSync(path).size;
    expect(size).toBeGreaterThan(fmt === 'WAV' ? 500_000 : 40_000);
    if (fmt === 'WAV') {
      const b = fs.readFileSync(path);
      const sr = b.readUInt32LE(24);
      const ch = b.readUInt16LE(22);
      const seconds = b.readUInt32LE(40) / (sr * ch * 2);
      // 1 bar at 84 BPM (≈2.86 s) + tail (reverb ≈ 2.8 s)
      expect(seconds).toBeGreaterThan(4.5);
      expect(seconds).toBeLessThan(13);
    }
    await expect(dialog.getByRole('status')).toContainText('Done');
  });
}
