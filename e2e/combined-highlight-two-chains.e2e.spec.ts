/**
 * Playwright E2E test for combined highlight across two selected chains.
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

async function openChainControls(page: Page, viewer: 'A' | 'B', mode: 'alignedto' | 'aligned') {
  await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
  await page.click(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
  await page.click(`#viewer-column-${viewer}-${mode}-select-chain-controls-toggle-btn`);
}

async function selectFirstChain(page: Page, viewer: 'A' | 'B') {
  const rows = page.locator(`[data-testid^="viewer-column-${viewer}-chain-table-row-"]`);
  await expect.poll(async () => rows.count(), { timeout: 30000 }).toBeGreaterThan(0);
  await rows.first().click();
}

async function selectSecondChain(page: Page, viewer: 'A' | 'B', mode: 'alignedto' | 'aligned') {
  await page.click(`#viewer-column-${viewer}-${mode}-select-chain2-controls-toggle-btn`);
  const rows = page.locator(`[data-testid^="viewer-column-${viewer}-${mode}-chain2-chain-table-row-"]`);
  await expect.poll(async () => rows.count(), { timeout: 30000 }).toBeGreaterThan(0);
  await rows.first().click();
}

async function enableResidueSelections(page: Page, viewer: 'A' | 'B', mode: 'alignedto' | 'aligned') {
  await page.click(`#viewer-column-${viewer}-${mode}-residue-controls-toggle-btn`);
  await expect(page.locator(`#viewer-column-${viewer}-${mode}-residue-select-all-btn`)).toBeEnabled({ timeout: 10000 });
  await page.click(`#viewer-column-${viewer}-${mode}-residue-select-all-btn`);

  await expect(page.locator(`#viewer-column-${viewer}-${mode}-residue2-controls-toggle-btn`)).toBeEnabled({ timeout: 10000 });
  await page.click(`#viewer-column-${viewer}-${mode}-residue2-controls-toggle-btn`);
  await expect(page.locator(`#viewer-column-${viewer}-${mode}-residue2-select-all-btn`)).toBeEnabled({ timeout: 10000 });
  await page.click(`#viewer-column-${viewer}-${mode}-residue2-select-all-btn`);
}

test('combined highlight toggles both chain highlight buttons on for AlignedTo', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/');
  await loadAlignedToAndAligned(page);

  await openChainControls(page, 'A', 'alignedto');
  await openChainControls(page, 'B', 'aligned');

  await selectFirstChain(page, 'A');
  await selectFirstChain(page, 'B');

  await selectSecondChain(page, 'A', 'alignedto');
  await selectSecondChain(page, 'B', 'aligned');

  await enableResidueSelections(page, 'A', 'alignedto');

  const combinedHighlightBtn = page.locator('#viewer-column-A-alignedto-highlight-combined-selection-btn');
  await expect(combinedHighlightBtn).toBeEnabled({ timeout: 10000 });

  const chain1HighlightBtn = page.locator('#viewer-column-A-alignedto-highlight-chain-btn');
  const chain2HighlightBtn = page.locator('#viewer-column-A-alignedto-highlight-chain2-btn');

  await expect(chain1HighlightBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(chain2HighlightBtn).toHaveAttribute('aria-pressed', 'false');

  await combinedHighlightBtn.click();

  await expect(chain1HighlightBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(chain2HighlightBtn).toHaveAttribute('aria-pressed', 'true');

  await combinedHighlightBtn.click();

  await expect(chain1HighlightBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(chain2HighlightBtn).toHaveAttribute('aria-pressed', 'false');
});
