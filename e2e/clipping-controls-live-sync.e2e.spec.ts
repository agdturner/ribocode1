/**
 * Playwright E2E test to ensure clipping controls live sync correctly after zoom operations.
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

test('Clip Radius stays consistent while clipping controls remain open after zoom', async ({ page }) => {
  test.setTimeout(240000);

  await page.goto('/');

  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });

  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1))
    .toHaveAttribute('aria-label', /^Hide\s+\S/, { timeout: 120000 });

  await page.click('#viewer-column-B-clipping-controls-toggle-btn');
  const clipRadiusInput = page.locator('#viewer-column-B-aligned-clip-far-number');
  await expect(clipRadiusInput).toBeVisible();

  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  await expect(page.locator('#viewer-column-B-chain-table-container')).toBeVisible({ timeout: 30000 });
  const chainRows = page.locator('[data-testid^="viewer-column-B-chain-table-row-"]');
  await expect(chainRows.first()).toBeVisible({ timeout: 30000 });
  await chainRows.first().click();

  await page.click('#viewer-column-B-aligned-zoom-chain-btn');

  await expect(async () => {
    const whileOpen = await clipRadiusInput.inputValue();

    await page.click('#viewer-column-B-clipping-controls-toggle-btn');
    await page.click('#viewer-column-B-clipping-controls-toggle-btn');

    const afterReopen = await clipRadiusInput.inputValue();
    expect(whileOpen).toBe(afterReopen);
  }).toPass({ timeout: 20000 });
});
