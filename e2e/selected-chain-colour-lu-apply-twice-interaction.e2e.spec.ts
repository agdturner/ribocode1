/**
 * Playwright E2E regression for LU chain color apply behavior.
 *
 * Covers: 4ug0.cif LU chain, initial swatch visibility, and two successive Apply actions.
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

async function openControls(page: Page) {
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-representation-controls-toggle-btn');
}

async function selectLuChain(page: Page) {
  const luRow = page.locator('[data-testid="viewer-column-A-chain-table-row-LU"]');
  await expect(luRow).toHaveCount(1, { timeout: 30000 });
  await luRow.click();
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).toContainText('LU');
}

async function saveThemeCsv(page: Page): Promise<Map<string, string>> {
  const downloadPromise = page.waitForEvent('download');
  await page.click('#viewer-column-A-alignedto-save-chain-theme-btn');
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  const text = await fs.readFile(filePath as string, 'utf-8');
  const lines = text.trim().split(/\r?\n/);
  const map = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const [chain, color] = line.split(',');
    if (!chain || !color) continue;
    map.set(chain.trim().toUpperCase(), color.trim().toUpperCase());
  }
  return map;
}

async function setChainColorDraft(page: Page, chainId: string, color: string) {
  await page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}`).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value as string;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
}

test('LU chain supports two successive Apply actions using user-style color input interactions', async ({ page }) => {
  test.setTimeout(120000);

  await loadAlignedToDataset(page);
  await openControls(page);
  await selectLuChain(page);

  const colorInput = page.locator('#viewer-column-A-alignedto-chain-color-LU');
  const applyButton = page.locator('#viewer-column-A-alignedto-chain-color-LU-apply-btn');

  await expect(colorInput).toBeVisible();
  await expect(applyButton).toBeVisible();

  const initial = (await colorInput.inputValue()).toUpperCase();
  expect(initial).not.toBe('#CCCCCC');

  const firstColor = initial === '#11AA33' ? '#CC4411' : '#11AA33';
  const secondColor = firstColor === '#CC4411' ? '#3366CC' : '#CC4411';

  await setChainColorDraft(page, 'LU', firstColor);
  await expect(colorInput).toHaveValue(firstColor.toLowerCase());
  await applyButton.click();
  const afterFirst = await saveThemeCsv(page);
  expect(afterFirst.get('LU')).toBe(firstColor);

  await setChainColorDraft(page, 'LU', secondColor);
  await expect(colorInput).toHaveValue(secondColor.toLowerCase());
  await applyButton.click();
  const afterSecond = await saveThemeCsv(page);
  expect(afterSecond.get('LU')).toBe(secondColor);
});
