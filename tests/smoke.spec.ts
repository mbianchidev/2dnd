import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/2DND Browser JRPG/);
});

test('game canvas loads', async ({ page }) => {
  await page.goto('/');
  
  // Wait for canvas to be present
  await page.waitForSelector('canvas');
  
  // Check if canvas is visible
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
});
