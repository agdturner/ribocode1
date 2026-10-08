/**
 * Playwright E2E test to ensure Aligned and AlignedTo buttons update independently.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Aligned and AlignedTo buttons update independently', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Column A: Only Load AlignedTo loader should be present
  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  const alignedToInputA = page.locator('#viewer-column-A-alignedto-file-input');
  await alignedToInputA.setInputFiles(dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/);
  await expect(alignedToBtnA).toHaveCount(0);

  // Column B: Only Load Aligned loader should be present
  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toBeEnabled({ timeout: 20000 });
  await alignedBtnB.click();
  const alignedInputB = page.locator('#viewer-column-B-aligned-file-input');
  await alignedInputB.setInputFiles(dataPath('6xu8.cif'));
  await expect(alignedBtnB).toHaveCount(0, { timeout: 20000 });

  // Both file names should now be visible in their respective columns
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/);
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
});
