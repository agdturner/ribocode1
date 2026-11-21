/**
 * Playwright E2E test for mirrored highlight controls across viewers.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function loadAlignedToAndAligned(page: Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+4UG0/i })).toBeVisible({ timeout: 30000 });

  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 20000 });
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.getByRole('button', { name: /(Hide|Show)\s+6XU8/i })).toBeVisible({ timeout: 30000 });
}

async function openHighlightControls(page: Page, viewer: 'A' | 'B') {
  await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
  await page.click(`#viewer-column-${viewer}-alignedto-subunit-controls-toggle-btn`);
  await page.click(`#viewer-column-${viewer}-alignedto-chain-controls-toggle-btn`);
}

test('AlignedTo highlight controls remain active across chain/subunit/residue toggles', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('/');
  await loadAlignedToAndAligned(page);

  await openHighlightControls(page, 'A');

  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  const chainRows = page.locator('[data-testid^="viewer-column-A-chain-table-row-"]');
  await expect.poll(async () => chainRows.count(), { timeout: 30000 }).toBeGreaterThan(0);
  await chainRows.first().click();

  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toBeEnabled({ timeout: 10000 });

  // Turn on chain highlight.
  await page.click('#viewer-column-A-alignedto-highlight-chain-btn');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'true');

  await page.click('#viewer-column-A-alignedto-residue-controls-toggle-btn');

  // Turn on subunit highlight and ensure chain highlight remains on.
  await page.click('#viewer-column-A-alignedto-highlight-subunit-btn');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'true');

  // Select residues and enable residue highlighting.
  await expect(page.locator('#viewer-column-A-alignedto-residue-select-all-btn')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewer-column-A-alignedto-residue-select-all-btn');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toBeEnabled({ timeout: 10000 });

  // Chain and residue highlight controls mirror the same mode-level highlight state.
  await expect(page.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'true');

  // Toggling residue highlight off should also turn chain highlight off, while subunit remains independent.
  await page.click('#viewer-column-A-alignedto-highlight-residue-btn');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'true');

  // Turning chain highlight back on should restore residue highlight state as well.
  await page.click('#viewer-column-A-alignedto-highlight-chain-btn');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#viewer-column-A-alignedto-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'true');
});
