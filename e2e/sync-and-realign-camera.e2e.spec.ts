/**
 * Playwright E2E tests for sync camera directionality and repeat re-align guard behavior.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-07-31
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function loadAlignedToAndAligned(page: import('@playwright/test').Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/i);

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toHaveCount(0, { timeout: 20000 });

  await expect(page.locator('#generalcontrols-sync-select')).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('repeat align attempts for the same pair remain available', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  await expect(page.locator('#viewer-column-A-chain-table-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-chain-table-container')).toBeVisible();

  const alignedToChainValues = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid^="viewer-column-A-chain-table-row-"]'))
      .map(row => (row.getAttribute('data-testid') || '').replace('viewer-column-A-chain-table-row-', ''))
      .filter(value => value && value !== '');
  });
  const alignedChainValues = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid^="viewer-column-B-chain-table-row-"]'))
      .map(row => (row.getAttribute('data-testid') || '').replace('viewer-column-B-chain-table-row-', ''))
      .filter(value => value && value !== '');
  });

  expect(alignedToChainValues.length).toBeGreaterThan(0);
  expect(alignedChainValues.length).toBeGreaterThan(0);

  const alignedToValue = alignedToChainValues[0];
  const alignedValue = alignedChainValues[0];
  const alternateAlignedValue = alignedChainValues.find(v => v !== alignedValue);

  await page.click(`[data-testid="viewer-column-A-chain-table-row-${alignedToValue}"]`);
  await page.click(`[data-testid="viewer-column-B-chain-table-row-${alignedValue}"]`);

  const realignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(realignBtn).toBeEnabled();

  await realignBtn.click();
  await expect(realignBtn).toBeEnabled({ timeout: 10000 });
  await expect(realignBtn).toHaveText(/Align Chains:\s*.+\s*→\s*.+/);

  // Change away from the pair and back; same-pair align remains available.
  if (alternateAlignedValue) {
    await page.click(`[data-testid="viewer-column-B-chain-table-row-${alternateAlignedValue}"]`);
    await expect(realignBtn).toBeEnabled();
    await page.click(`[data-testid="viewer-column-B-chain-table-row-${alignedValue}"]`);
    await expect(realignBtn).toBeEnabled();
  }
});
