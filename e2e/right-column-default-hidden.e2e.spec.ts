/**
 * Playwright E2E test to verify right-column defaults after loading AlignedTo/Aligned.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-26
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('AlignedTo is hidden in right viewer and Aligned is hidden in left viewer by default', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('/');

  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles(dataPath('4ug0.cif'));
  await expect(page.getByRole('button', { name: /Hide 4UG0/i })).toBeVisible({ timeout: 30000 });

  const alignedToToggleB = page.locator('#viewer-column-B-toggle-visibility-btn').first();
  await expect(alignedToToggleB).toBeVisible();
  await expect(alignedToToggleB).toHaveAttribute('aria-label', /show/i);

  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toBeEnabled({ timeout: 60000 });
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toContainText(/6xu8\.cif/i, { timeout: 60000 });

  const alignedToggleA = page.locator('#viewer-column-A-toggle-visibility-btn').nth(1);
  await expect(alignedToggleA).toHaveAttribute('aria-label', /show 6xu8/i, { timeout: 60000 });
});
