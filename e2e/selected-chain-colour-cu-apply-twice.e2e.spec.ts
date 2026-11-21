/**
 * Playwright E2E regression for selected-chain colour apply behavior.
 *
 * Covers: 4ug0.cif chain CU, initial swatch visibility, and two successive Apply actions.
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
  await expect(page.locator('#viewer-column-A-alignedto-load-btn')).toBeVisible({ timeout: 45000 });
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });
}

async function openChainAndRepresentationControls(page: Page) {
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-representation-controls-toggle-btn');
}

async function selectTargetChain(page: Page): Promise<string> {
  const rows = page.locator('[data-testid^="viewer-column-A-chain-table-row-"]');
  await expect.poll(async () => rows.count(), { timeout: 30000 }).toBeGreaterThan(0);

  const cuRow = page.locator('[data-testid="viewer-column-A-chain-table-row-CU"]');
  if (await cuRow.count() > 0) {
    await cuRow.first().click();
    await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).toContainText('CU');
    return 'CU';
  }

  const first = rows.first();
  const rowId = (await first.getAttribute('data-testid')) ?? '';
  const selectedChain = rowId.replace('viewer-column-A-chain-table-row-', '').trim().toUpperCase();
  await first.click();
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).not.toContainText('None');
  return selectedChain;
}

async function saveThemeCsv(page: Page): Promise<Map<string, string>> {
  const downloadPromise = page.waitForEvent('download');
  await page.click('#viewer-column-A-alignedto-save-chain-theme-btn');
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
    map.set(chain.trim().toUpperCase(), color.trim().toUpperCase());
  }
  return map;
}

async function setSelectedChainColorDraft(page: Page, chainId: string, color: string) {
  await page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}`).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value as string;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
}

test('selected chain swatch is not grey and two Apply actions persist successive colours', async ({ page }) => {
  test.setTimeout(120000);

  await loadAlignedToDataset(page);
  await openChainAndRepresentationControls(page);
  const targetChain = await selectTargetChain(page);

  const selectedColorInput = page.locator(`#viewer-column-A-alignedto-chain-color-${targetChain}`);
  await expect(selectedColorInput).toBeVisible();

  const initialSwatch = (await selectedColorInput.inputValue()).toUpperCase();
  expect(initialSwatch).not.toBe('#CCCCCC');

  const baseline = await saveThemeCsv(page);
  expect(baseline.get(targetChain)).toBeTruthy();

  const firstColor = '#12AB34';
  await setSelectedChainColorDraft(page, targetChain, firstColor);
  await page.click(`#viewer-column-A-alignedto-chain-color-${targetChain}-apply-btn`);

  const afterFirstApply = await saveThemeCsv(page);
  expect(afterFirstApply.get(targetChain)).toBe(firstColor);

  const secondColor = '#EE5522';
  await setSelectedChainColorDraft(page, targetChain, secondColor);
  await page.click(`#viewer-column-A-alignedto-chain-color-${targetChain}-apply-btn`);

  const afterSecondApply = await saveThemeCsv(page);
  expect(afterSecondApply.get(targetChain)).toBe(secondColor);

  const changedChains: string[] = [];
  const allChains = new Set<string>([...afterFirstApply.keys(), ...afterSecondApply.keys()]);
  for (const chain of allChains) {
    const before = afterFirstApply.get(chain) ?? '';
    const after = afterSecondApply.get(chain) ?? '';
    if (before !== after) changedChains.push(chain);
  }
  expect(changedChains).toEqual([targetChain]);
});
