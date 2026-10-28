/**
 * Playwright E2E test to ensure the Load Aligned button in Column B is not removed when only AlignedTo data are loaded.
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

test('Load Aligned button in Column B remains after loading AlignedTo in Column A', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('http://localhost:5173/');

  // Find and click the Load AlignedTo button in column A, then upload file
  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  const alignedToInputA = page.locator('#viewer-column-A-alignedto-file-input');
  await alignedToInputA.setInputFiles(dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });

  // The Load Aligned button in column B should still be present and enabled
  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toHaveCount(1);
  await expect(alignedBtnB).toBeEnabled({ timeout: 60000 });
});
