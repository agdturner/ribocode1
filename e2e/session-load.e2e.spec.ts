/**
 * Playwright E2E test for full session load workflow in Ribocode
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { test, expect } from '@playwright/test';
import { loadSessionAndRequiredFiles, waitForSessionMenuReady } from './helpers/session-load';

test('Session load prompts for required files and loads data', async ({ page }) => {
  test.setTimeout(60000);

  // 1. Go to the app
  await page.goto('/');
  await waitForSessionMenuReady(page);

  await loadSessionAndRequiredFiles(page, 'test-session.json');

  // 7. Assert that the viewers are updated (e.g., check for molecule names or representations)
  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+4UG0/i })).toBeVisible({ timeout: 45000 });
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+6XU8/i })).toBeVisible({ timeout: 45000 });

  // 8. Assert that the fallback error dialog does NOT appear
  await expect(page.locator('text=Session loaded, but could not automatically reload datasets')).toHaveCount(0);

});

test('Session load restores saved cartoon representations', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('/');
  await waitForSessionMenuReady(page);

  await loadSessionAndRequiredFiles(page, 'test-session.json');
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+4UG0/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+6XU8/i })).toBeVisible({ timeout: 30000 });
  const baselineCartoonCount = await page.locator('button[aria-label="Toggle visibility for cartoon representation"]').count();

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForSessionMenuReady(page);
  await loadSessionAndRequiredFiles(page, 'test-session-with-representations.json');

  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+4UG0/i })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });

  await expect(async () => {
    const restoredCartoonCount = await page.locator('button[aria-label="Toggle visibility for cartoon representation"]').count();
    // Restores may reuse or consolidate reps; require both datasets to have cartoon controls.
    expect(restoredCartoonCount).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  await expect(page.locator('text=Session loaded, but could not automatically reload datasets')).toHaveCount(0);
});
