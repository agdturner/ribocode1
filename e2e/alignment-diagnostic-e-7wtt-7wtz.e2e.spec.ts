/**
 * Playwright E2E diagnostic for chain alignment quality using 7WTT -> 7WTZ on chain e.
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
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('7WTT.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTT/i })).toBeVisible({ timeout: 30000 });

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('7WTZ.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTZ/i })).toBeVisible({ timeout: 30000 });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('diagnostic: Align Chains on e reports metrics', async ({ page }) => {
  test.setTimeout(240000);

  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);

  const anchorDiagnostics = await page.evaluate(() => {
    const api = (window as any).__ribocodeTestApi;
    return (['AlignedTo', 'Aligned'] as const).map(mode => {
      const byChain = (chain: string) => {
        const anchors = api.getInitialAlignmentCoordinates('A', mode, chain).anchors;
        return {
          types: anchors.symbolTypes.reduce((counts: Record<string, number>, type: string) => {
            counts[type] = (counts[type] ?? 0) + 1;
            return counts;
          }, {}),
          count: anchors.residueKeys.length,
        };
      };
      return { mode, lower: byChain('e'), upper: byChain('E') };
    });
  });
  console.log('[Weak benchmark chain-case browser diagnostic]', JSON.stringify(anchorDiagnostics));

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  const alignedToChainRow = page.locator('[data-testid="viewer-column-A-chain-table-row-e"]');
  const alignedChainRow = page.locator('[data-testid="viewer-column-B-chain-table-row-e"]');

  await expect(alignedToChainRow).toBeVisible({ timeout: 30000 });
  await expect(alignedChainRow).toBeVisible({ timeout: 30000 });

  await alignedToChainRow.click();
  await alignedChainRow.click();

  const realignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(realignBtn).toBeEnabled();
  await expect(realignBtn).toHaveText(/Align Chains:\s*e\s*->\s*e|Align Chains:\s*e\s*→\s*e/i);

  await realignBtn.click();
  await expect(realignBtn).toBeEnabled({ timeout: 30000 });

  const metricsHandle = await page.waitForFunction(() => {
    const api = (window as any).__ribocodeTestApi;
    const metrics = api?.getLastRealignMetrics?.()?.chain;
    if (!metrics) return null;
    if (String(metrics.alignedToChainId).toLowerCase() !== 'e') return null;
    if (String(metrics.alignedChainId).toLowerCase() !== 'e') return null;
    if (!Number.isFinite(metrics.rmsd) || !Number.isFinite(metrics.improvementRatio)) return null;
    return metrics;
  }, { timeout: 30000 });

  const metrics = await metricsHandle.jsonValue() as ChainRealignMetrics;

  expect(metrics.atomPairCount).toBeGreaterThan(0);
  expect(Number.isFinite(metrics.rmsd)).toBeTruthy();
  expect(Number.isFinite(metrics.improvementRatio)).toBeTruthy();

  console.log('[E2E Alignment Metrics][7WTT->7WTZ][e->e]', metrics);
});
