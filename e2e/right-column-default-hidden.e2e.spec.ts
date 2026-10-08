/**
 * Playwright E2E test to verify right-column defaults after loading AlignedTo/Aligned.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-07-23
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('AlignedTo is hidden in right viewer and Aligned is hidden in left viewer by default', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles(dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/i);

  const alignedToToggleB = page.locator('#viewer-column-B-moleculeui-4ug0 #viewer-column-B-toggle-visibility-btn');
  await expect(alignedToToggleB).toBeVisible();
  await expect(alignedToToggleB).toHaveAttribute('aria-label', /show/i);
  await alignedToToggleB.click();
  await expect(alignedToToggleB).toHaveAttribute('aria-label', /hide/i);

  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toBeEnabled({ timeout: 20000 });
  await alignedBtnB.click();
  await page.locator('#viewer-column-B-aligned-file-input').setInputFiles(dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-moleculeui-6xu8')).toBeVisible({ timeout: 20000 });

  const alignedToggleA = page.locator('#viewer-column-A-moleculeui-6xu8 #viewer-column-A-toggle-visibility-btn');
  await expect(alignedToggleA).toBeVisible();
  await expect(alignedToggleA).toHaveAttribute('aria-label', /show/i);
  await alignedToggleA.click();
  await expect(alignedToggleA).toHaveAttribute('aria-label', /hide/i);
});
