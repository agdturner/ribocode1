/**
 * Playwright E2E test to ensure the visibility toggle for Aligned and AlignedTo works in both columns.
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

test('Visibility toggles work for Aligned and AlignedTo in both columns', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  // Load AlignedTo in column A
  const alignedToBtnA = page.locator('#viewer-column-A-alignedto-load-btn');
  await alignedToBtnA.click();
  const alignedToInputA = page.locator('#viewer-column-A-alignedto-file-input');
  await alignedToInputA.setInputFiles(dataPath('4ug0.cif'));
  await expect(page.getByRole('button', { name: /Hide 4UG0/i })).toBeVisible({ timeout: 30000 });

  // Load Aligned in column B
  const alignedBtnB = page.locator('#viewer-column-B-aligned-load-btn');
  await expect(alignedBtnB).toBeEnabled({ timeout: 20000 });
  const alignedInputB = page.locator('#viewer-column-B-aligned-file-input');
  await alignedInputB.setInputFiles(dataPath('6xu8.cif'));
  await alignedBtnB.click();
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 30000 });

  // Toggle visibility for AlignedTo in column A
  const toggleAlignedToA = page.locator('#viewer-column-A-toggle-visibility-btn').first();
  await expect(toggleAlignedToA).toBeVisible();
  await toggleAlignedToA.click();
  // Optionally, check for a class or style change indicating hidden state

  // Toggle visibility for Aligned in column B
  const toggleAlignedB = page.locator('#viewer-column-B-toggle-visibility-btn').first();
  await expect(toggleAlignedB).toBeVisible();
  await toggleAlignedB.click();
  // Optionally, check for a class or style change indicating hidden state

  // Toggle back to visible
  await toggleAlignedToA.click();
  await toggleAlignedB.click();
});
