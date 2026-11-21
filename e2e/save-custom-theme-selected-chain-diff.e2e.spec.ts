/**
 * Playwright E2E test for custom chain-theme export diffing.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { promises as fs } from 'fs';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function loadAlignedToDataset(page: Page) {
  await page.goto('/');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });
}

async function selectFirstAlignedToChain(page: Page): Promise<string> {
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');

  const rows = page.locator('[data-testid^="viewer-column-A-chain-table-row-"]');
  await expect.poll(async () => rows.count(), { timeout: 30000 }).toBeGreaterThan(0);
  const row = rows.first();
  const rowId = (await row.getAttribute('data-testid')) ?? '';
  const chainId = rowId.replace('viewer-column-A-chain-table-row-', '').trim();
  await row.click();
  return chainId;
}

async function openRepresentationControls(page: Page) {
  const controlsToggle = page.locator('#viewer-column-A-alignedto-representation-controls-toggle-btn').first();
  await controlsToggle.click();
  await expect(page.locator('#viewer-column-A-alignedto-save-chain-theme-btn').first()).toBeVisible();
}

async function saveThemeCsv(page: Page): Promise<Map<string, string>> {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#viewer-column-A-alignedto-save-chain-theme-btn').first().click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const text = await fs.readFile(filePath as string, 'utf-8');

  const lines = text.trim().split(/\r?\n/);
  expect(lines[0]?.toLowerCase()).toBe('chain,color');
  const map = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const [chain, color] = line.split(',');
    if (!chain || !color) continue;
    map.set(chain.trim(), color.trim().toUpperCase());
  }
  return map;
}

async function setSelectedChainColor(page: Page, chainId: string, color: string) {
  await page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}`).first().evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value as string;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
  await page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}-apply-btn`).first().click();
}

test('saving baseline and modified theme only changes selected chain color', async ({ page }) => {
  test.setTimeout(120000);

  await loadAlignedToDataset(page);
  const selectedChain = await selectFirstAlignedToChain(page);
  expect(selectedChain).not.toBe('');

  await openRepresentationControls(page);

  const baseline = await saveThemeCsv(page);
  expect(baseline.size).toBeGreaterThan(0);

  const updatedColor = '#12AB34';
  await setSelectedChainColor(page, selectedChain, updatedColor);

  const modified = await saveThemeCsv(page);
  expect(modified.size).toBeGreaterThan(0);

  const selectedChainUpper = selectedChain.toUpperCase();

  const allChains = new Set<string>([...baseline.keys(), ...modified.keys()]);
  const changedChains: string[] = [];
  for (const chain of allChains) {
    const before = baseline.get(chain) ?? '';
    const after = modified.get(chain) ?? '';
    if (before !== after) changedChains.push(chain);
  }

  expect(changedChains.map(c => c.toUpperCase())).toEqual([selectedChainUpper]);
  expect(modified.get(selectedChain) ?? modified.get(selectedChainUpper)).toBe(updatedColor);

  const nonSelectedGreys = [...modified.entries()]
    .filter(([chain]) => chain.toUpperCase() !== selectedChainUpper)
    .filter(([, color]) => color.toUpperCase() === '#CCCCCC' || color.toUpperCase() === '#FAFAFA');
  expect(nonSelectedGreys.length).toBe(0);
});
