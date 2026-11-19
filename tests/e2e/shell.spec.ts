import { test, expect } from '@playwright/test';

test('app shell renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Top bar')).toBeVisible();
  await expect(page.getByLabel('Song timeline')).toBeVisible();
});
