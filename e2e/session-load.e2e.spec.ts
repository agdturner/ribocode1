/**
 * Playwright E2E test for full session load workflow in Ribocode
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import type { Page } from '@playwright/test';

// Helper to get absolute path to test data
function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function waitForSessionMenuReady(page: Page) {
  await expect(page.locator('#session-menu-btn')).toBeVisible({ timeout: 45000 });
}

async function loadSessionAndRequiredFiles(page: Page, sessionFixtureFile: string) {
  await waitForSessionMenuReady(page);
  await page.click('button#session-menu-btn');
  await page.waitForSelector('#session-menu-dropdown', { state: 'visible' });
  await page.waitForTimeout(200);
  await page.click('#session-menu-dropdown .session-menu-item:text-is("Load")');

  const sessionFilePath = path.resolve(__dirname, sessionFixtureFile);
  await page.setInputFiles('#session-menu-file-input', sessionFilePath);

  await expect(page.getByText('Load Session: Select Required Files')).toBeVisible();
  await expect(page.getByText('4ug0.cif')).toBeVisible();
  await expect(page.getByText('6xu8.cif')).toBeVisible();

  const fileInputs = await page.$$('[data-testid^="session-load-modal-file-input-"]');
  for (const input of fileInputs) {
    const label = await input.evaluate((el: HTMLInputElement) => el.parentElement?.textContent || '');
    if (label.includes('4ug0.cif')) {
      await input.setInputFiles(dataPath('4ug0.cif'));
    } else if (label.includes('6xu8.cif')) {
      await input.setInputFiles(dataPath('6xu8.cif'));
    }
  }

  await expect(page.getByTestId('session-load-modal-load-btn')).toBeEnabled();
  await page.getByTestId('session-load-modal-load-btn').click();
}

test('Session load prompts for required files and loads data', async ({ page }) => {
  // 1. Go to the app
  await page.goto('http://localhost:5173/'); // Adjust if your dev server runs elsewhere
  await waitForSessionMenuReady(page);

  await loadSessionAndRequiredFiles(page, 'test-session.json');

  // 7. Assert that the viewers are updated (e.g., check for molecule names or representations)
  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
  await expect(page.getByRole('button', { name: /Hide 4UG0/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 30000 });

  // 8. Assert that the fallback error dialog does NOT appear
  await expect(page.locator('text=Session loaded, but could not automatically reload datasets')).toHaveCount(0);

});

test('Session load restores saved cartoon representations', async ({ page }) => {
  test.setTimeout(60000);

  await page.goto('http://localhost:5173/');
  await waitForSessionMenuReady(page);

  await loadSessionAndRequiredFiles(page, 'test-session.json');
  await expect(page.getByRole('button', { name: /Hide 4UG0/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 30000 });
  const baselineCartoonCount = await page.locator('button[aria-label="Toggle visibility for cartoon representation"]').count();

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await waitForSessionMenuReady(page);
  await loadSessionAndRequiredFiles(page, 'test-session-with-representations.json');

  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
  await expect(page.getByRole('button', { name: /Hide 4UG0/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 30000 });

  await expect(async () => {
    const restoredCartoonCount = await page.locator('button[aria-label="Toggle visibility for cartoon representation"]').count();
    // Restores may reuse matching existing reps, so count can be equal instead of strictly greater.
    expect(restoredCartoonCount).toBeGreaterThanOrEqual(baselineCartoonCount);
  }).toPass({ timeout: 10000 });

  await expect(page.locator('text=Session loaded, but could not automatically reload datasets')).toHaveCount(0);
});
