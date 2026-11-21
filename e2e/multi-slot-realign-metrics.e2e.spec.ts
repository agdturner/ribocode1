/**
 * Playwright E2E regression for multi-slot chain/residue realignment metrics.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

type ChainRealignMetrics = {
  timestamp: number;
  atomPairCount: number;
  alignedToChainId: string;
  alignedChainId: string;
};

type ResidueRealignMetrics = {
  timestamp: number;
  atomPairCount: number;
  alignedToChainId: string;
  alignedChainId: string;
  alignedToResidueIds: string[];
  alignedResidueIds: string[];
};

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

async function getChainIdsByPrefix(page: Page, prefix: string): Promise<string[]> {
  return page.evaluate((rowPrefix) => {
    return Array.from(document.querySelectorAll(`[data-testid^="${rowPrefix}"]`))
      .map((row) => (row.getAttribute('data-testid') || '').replace(rowPrefix, ''))
      .filter((id) => id.length > 0);
  }, prefix);
}

async function clickChainRow(page: Page, prefix: string, chainId: string) {
  await page.click(`[data-testid="${prefix}${chainId}"]`);
}

async function waitForChainMetrics(page: Page, afterTimestamp = 0): Promise<ChainRealignMetrics> {
  const outcome = await page.waitForFunction(
    ({ ts }) => {
      const api = (window as any).__ribocodeTestApi;
      const metrics = api?.getLastRealignMetrics?.()?.chain;
      if (!metrics || !Number.isFinite(metrics.timestamp)) return null;
      if (metrics.timestamp <= ts) return null;
      return metrics;
    },
    { ts: afterTimestamp },
    { timeout: 30000 }
  );
  return await outcome.jsonValue() as ChainRealignMetrics;
}

async function waitForResidueMetrics(page: Page, afterTimestamp = 0): Promise<ResidueRealignMetrics> {
  const outcome = await page.waitForFunction(
    ({ ts }) => {
      const api = (window as any).__ribocodeTestApi;
      const metrics = api?.getLastRealignMetrics?.()?.residue;
      if (!metrics || !Number.isFinite(metrics.timestamp)) return null;
      if (metrics.timestamp <= ts) return null;
      return metrics;
    },
    { ts: afterTimestamp },
    { timeout: 30000 }
  );
  return await outcome.jsonValue() as ResidueRealignMetrics;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('Align Chains and Align Residues increase paired atoms when slot 2 is added', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/');
  await loadAlignedToAndAligned(page);

  await openChainControls(page, 'A', 'alignedto');
  await openChainControls(page, 'B', 'aligned');

  const chain1IdsA = await getChainIdsByPrefix(page, 'viewer-column-A-chain-table-row-');
  const chain1IdsB = await getChainIdsByPrefix(page, 'viewer-column-B-chain-table-row-');
  expect(chain1IdsA.length).toBeGreaterThan(1);
  expect(chain1IdsB.length).toBeGreaterThan(1);

  const chain1A = chain1IdsA[0];
  const chain1B = chain1IdsB[0];
  await clickChainRow(page, 'viewer-column-A-chain-table-row-', chain1A);
  await clickChainRow(page, 'viewer-column-B-chain-table-row-', chain1B);

  const chainRealignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(chainRealignBtn).toBeEnabled({ timeout: 10000 });
  await chainRealignBtn.click();
  const chainMetricsSlot1 = await waitForChainMetrics(page);
  expect(chainMetricsSlot1.atomPairCount).toBeGreaterThan(0);

  await page.click('#viewer-column-A-alignedto-select-chain2-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain2-controls-toggle-btn');

  const chain2IdsA = await getChainIdsByPrefix(page, 'viewer-column-A-alignedto-chain2-chain-table-row-');
  const chain2IdsB = await getChainIdsByPrefix(page, 'viewer-column-B-aligned-chain2-chain-table-row-');
  const chain2A = chain2IdsA.find((id) => id !== chain1A) ?? chain2IdsA[0];
  const chain2B = chain2IdsB.find((id) => id !== chain1B) ?? chain2IdsB[0];
  expect(chain2A).toBeTruthy();
  expect(chain2B).toBeTruthy();

  await clickChainRow(page, 'viewer-column-A-alignedto-chain2-chain-table-row-', chain2A as string);
  await clickChainRow(page, 'viewer-column-B-aligned-chain2-chain-table-row-', chain2B as string);

  await expect(chainRealignBtn).toBeEnabled({ timeout: 10000 });
  await chainRealignBtn.click();
  const chainMetricsSlot12 = await waitForChainMetrics(page, chainMetricsSlot1.timestamp);
  expect(chainMetricsSlot12.atomPairCount).toBeGreaterThanOrEqual(chainMetricsSlot1.atomPairCount);
  expect(chainMetricsSlot12.alignedToChainId).toContain(chain1A);
  expect(chainMetricsSlot12.alignedToChainId).toContain(chain2A as string);
  expect(chainMetricsSlot12.alignedChainId).toContain(chain1B);
  expect(chainMetricsSlot12.alignedChainId).toContain(chain2B as string);

  await page.click('#viewer-column-A-alignedto-residue-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-residue-controls-toggle-btn');
  await expect(page.locator('#viewer-column-A-alignedto-residue-select-all-btn')).toBeEnabled({ timeout: 10000 });
  await expect(page.locator('#viewer-column-B-aligned-residue-select-all-btn')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewer-column-A-alignedto-residue-select-all-btn');
  await page.click('#viewer-column-B-aligned-residue-select-all-btn');

  const residueRealignBtn = page.locator('#generalcontrols-realign-residue-btn');
  await expect(residueRealignBtn).toBeEnabled({ timeout: 10000 });
  await residueRealignBtn.click();
  const residueMetricsSlot1 = await waitForResidueMetrics(page);
  expect(residueMetricsSlot1.atomPairCount).toBeGreaterThan(0);
  expect(residueMetricsSlot1.alignedToResidueIds.length).toBeGreaterThan(0);
  expect(residueMetricsSlot1.alignedResidueIds.length).toBeGreaterThan(0);

  await page.click('#viewer-column-A-alignedto-residue2-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-residue2-controls-toggle-btn');
  await expect(page.locator('#viewer-column-A-alignedto-residue2-select-all-btn')).toBeEnabled({ timeout: 10000 });
  await expect(page.locator('#viewer-column-B-aligned-residue2-select-all-btn')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewer-column-A-alignedto-residue2-select-all-btn');
  await page.click('#viewer-column-B-aligned-residue2-select-all-btn');

  await expect(residueRealignBtn).toBeEnabled({ timeout: 10000 });
  await residueRealignBtn.click();
  const residueMetricsSlot12 = await waitForResidueMetrics(page, residueMetricsSlot1.timestamp);
  expect(residueMetricsSlot12.atomPairCount).toBeGreaterThanOrEqual(residueMetricsSlot1.atomPairCount);
  expect(residueMetricsSlot12.alignedToChainId).toContain(chain1A);
  expect(residueMetricsSlot12.alignedToChainId).toContain(chain2A as string);
  expect(residueMetricsSlot12.alignedChainId).toContain(chain1B);
  expect(residueMetricsSlot12.alignedChainId).toContain(chain2B as string);
  expect(residueMetricsSlot12.alignedToResidueIds.length).toBeGreaterThanOrEqual(residueMetricsSlot1.alignedToResidueIds.length);
  expect(residueMetricsSlot12.alignedResidueIds.length).toBeGreaterThanOrEqual(residueMetricsSlot1.alignedResidueIds.length);
});
