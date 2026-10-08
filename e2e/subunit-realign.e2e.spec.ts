/**
 * Playwright E2E tests for subunit re-alignment button state transitions.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-09-02
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
}

async function selectSubunitWithChains(
  page: import('@playwright/test').Page,
  subunitSelect: string,
  chainRowPrefix: string
): Promise<string> {
  const values = await page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(`${selector} option`))
      .map(opt => (opt as HTMLOptionElement).value)
      .filter(value => value && value !== '' && value !== 'All');
  }, subunitSelect);

  for (const value of values) {
    await page.selectOption(subunitSelect, value);
    await page.waitForTimeout(50);
    const chainCount = await page.evaluate((prefix) => {
      return document.querySelectorAll(`[data-testid^="${prefix}"]`).length;
    }, chainRowPrefix);
    if (chainCount > 0) return value;
  }

  throw new Error(`No non-All subunit with chain options found for ${subunitSelect}`);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('Align Subunits button enables and remains available for repeated pairs', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-subunit-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-subunit-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  const realignSubunitBtn = page.locator('#generalcontrols-realign-subunit-btn');
  await expect(realignSubunitBtn).toBeDisabled();
  await expect(realignSubunitBtn).toHaveText('Align Subunits');

  const alignedToSubunit = await selectSubunitWithChains(
    page,
    '#viewer-column-A-alignedto-subunit-select',
    'viewer-column-A-chain-table-row-'
  );
  const alignedSubunit = await selectSubunitWithChains(
    page,
    '#viewer-column-B-aligned-subunit-select',
    'viewer-column-B-chain-table-row-'
  );

  await expect(realignSubunitBtn).toBeEnabled();
  await expect(realignSubunitBtn).toHaveText(`Align Subunits: ${alignedToSubunit} -> ${alignedSubunit}`);

  await realignSubunitBtn.click();

  await expect(realignSubunitBtn).toBeEnabled({ timeout: 10000 });
  await expect(realignSubunitBtn).toHaveText(`Align Subunits: ${alignedToSubunit} -> ${alignedSubunit}`);
});
