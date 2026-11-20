import { test, expect } from '@playwright/test';

test('pump to the kick and humanize', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ss:seenHint', '1'));
  await page.goto('/');
  await page.getByRole('row', { name: 'Track Chords' }).click();
  await page.getByRole('tab', { name: 'Effects' }).click();
  await page.getByRole('button', { name: '💓 Pump to the kick' }).click();
  const card = page.getByLabel('Duck (pump)');
  await expect(card).toBeVisible();
  await expect(card.getByLabel('Duck when this track plays')).toHaveValue(/.+/);
  await expect(page.getByRole('row', { name: 'Track Chords' })).toContainText('⤵ Kick');
  // switch it off and back on, then undo the pump entirely
  await card.getByRole('switch', { name: 'Duck on' }).click();
  await expect(page.getByRole('row', { name: 'Track Chords' })).not.toContainText('⤵');
  await card.getByRole('switch', { name: 'Duck on' }).click();

  await page.getByRole('tab', { name: 'Sound' }).click();
  const human = page.getByRole('slider', { name: /Humanize/ });
  await expect(human).toBeVisible();
  await human.focus();
  await page.keyboard.press('ArrowUp');
  await expect(human).toHaveAttribute('aria-valuetext', /%/);
});

test('a MIDI keyboard plays the selected track in key', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ss:seenHint', '1');
    // a fake MIDI keyboard
    const input = {
      id: 'fake-1',
      name: 'Fake Keys',
      onmidimessage: null as null | ((e: { data: Uint8Array }) => void),
    };
    const inputs = new Map([[input.id, input]]);
    (window as unknown as Record<string, unknown>).__midiSend = (bytes: number[]) =>
      input.onmidimessage?.({ data: new Uint8Array(bytes) });
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      value: () => Promise.resolve({ inputs, outputs: new Map(), onstatechange: null }),
    });
  });
  await page.goto('/');
  await page.getByRole('row', { name: 'Track Chords' }).click();
  await page.getByRole('button', { name: 'MIDI keyboard' }).click();
  await page.getByRole('switch', { name: 'MIDI input' }).click();
  await expect(page.getByRole('dialog', { name: 'MIDI keyboard settings' })).toContainText(
    'Connected: Fake Keys',
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() =>
    (window as unknown as { __midiSend: (b: number[]) => void }).__midiSend([0x90, 61, 100]),
  );
  await expect(page.locator('[class*="lit"]').first()).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __midiSend: (b: number[]) => void }).__midiSend([0x80, 61, 0]),
  );
  await expect(page.locator('[class*="lit"]')).toHaveCount(0);
});
