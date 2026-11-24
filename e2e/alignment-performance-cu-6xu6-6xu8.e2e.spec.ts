/**
 * Playwright E2E test for chain alignment performance metrics using 6XU6 -> 6XU8 on chain CU.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

type ChainRealignMetrics = {
  timestamp: number;
  alignedToChainId: string;
  alignedChainId: string;
  atomPairCount: number;
  rmsd: number;
  meanPairDistanceBefore: number;
  meanPairDistanceAfter: number;
  improvementRatio: number;
};

async function loadAlignedToAndAligned(page: import('@playwright/test').Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('6XU6.cif'));
  await expect(page.getByRole('button', { name: /Hide 6XU6/i })).toBeVisible({ timeout: 120000 });

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 120000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('Align Chains on CU reports stable performance metrics', async ({ page }) => {
  test.setTimeout(240000);

  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  const alignedToCuRow = page.locator('[data-testid="viewer-column-A-chain-table-row-CU"]');
  const alignedCuRow = page.locator('[data-testid="viewer-column-B-chain-table-row-CU"]');

  await expect(alignedToCuRow).toBeVisible({ timeout: 30000 });
  await expect(alignedCuRow).toBeVisible({ timeout: 30000 });

  await alignedToCuRow.click();
  await alignedCuRow.click();

  const realignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(realignBtn).toBeEnabled();
  await expect(realignBtn).toHaveText(/Align Chains:\s*CU\s*->\s*CU|Align Chains:\s*CU\s*→\s*CU/);

  await realignBtn.click();
  await expect(realignBtn).toBeEnabled({ timeout: 20000 });

  const metricsHandle = await page.waitForFunction(() => {
    const api = (window as any).__ribocodeTestApi;
    const metrics = api?.getLastRealignMetrics?.()?.chain;
    if (!metrics) return null;
    if (metrics.alignedToChainId !== 'CU' || metrics.alignedChainId !== 'CU') return null;
    if (!Number.isFinite(metrics.rmsd) || !Number.isFinite(metrics.improvementRatio)) return null;
    return metrics;
  }, { timeout: 20000 });

  const metrics = await metricsHandle.jsonValue() as ChainRealignMetrics;

  expect(metrics.atomPairCount).toBeGreaterThan(90);
  expect(metrics.rmsd).toBeLessThan(7);
  expect(metrics.meanPairDistanceAfter).toBeLessThan(metrics.meanPairDistanceBefore);
  expect(metrics.improvementRatio).toBeGreaterThan(10);

  // Keep a clear metric record in test output for release diagnostics.
  console.log('[E2E Alignment Metrics][6XU6->6XU8][CU->CU]', metrics);
});
