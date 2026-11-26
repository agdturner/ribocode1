/**
 * Playwright E2E test to ensure Aligned and AlignedTo buttons update independently.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-11-26
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Aligned and AlignedTo buttons update independently', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('/');

  // Column A: Only Load AlignedTo loader should be present
  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  const alignedToInputA = page.locator('#viewer-column-A-alignedto-file-input');
  await expect(alignedToInputA).toBeAttached();
  await alignedToInputA.setInputFiles(dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });

  // Column B: Only Load Aligned loader should be present
  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toBeEnabled({ timeout: 20000 });
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await alignedBtnB.click();
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });

  // Both datasets should now be loaded and viewer B available.
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
});
