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
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toContainText(/4ug0\.cif/i, { timeout: 30000 });

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toContainText(/6xu8\.cif/i, { timeout: 30000 });

  // Cross-viewer controls are only fully interactive after both datasets settle.
  await expect(page.locator('#generalcontrols-sync-select')).toBeEnabled({ timeout: 60000 });
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
  test.setTimeout(120000);

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

  // Use dispatchEvent to avoid occasional auto-wait instability on click under parallel load.
  await realignSubunitBtn.dispatchEvent('click');

  await expect(realignSubunitBtn).toBeEnabled({ timeout: 20000 });
  await expect(realignSubunitBtn).toHaveText(`Align Subunits: ${alignedToSubunit} -> ${alignedSubunit}`);
});

test('6XU6/6xu8 subunit buckets do not swap Large/Small categories', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('http://localhost:5173/');

  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('6XU6.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toContainText(/6XU6\.cif/i, { timeout: 30000 });

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toContainText(/6xu8\.cif/i, { timeout: 30000 });

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-subunit-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-subunit-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  const diagnostics = await page.waitForFunction(() => {
    const api = (window as any).__ribocodeTestApi;
    return api?.getSubunitDiagnostics?.() ?? null;
  }, null, { timeout: 30000 });

  const data = await diagnostics.jsonValue() as {
    alignedTo: { subunitToChainIds: Record<string, string[]> };
    aligned: { subunitToChainIds: Record<string, string[]> };
  };

  const assertViewerSubunitRowsMatchDiagnostics = async (
    subunitSelect: string,
    chainRowPrefix: string,
    expectedBySubunit: Record<string, string[]>
  ) => {
    for (const subunit of ['Large', 'Small', 'Other']) {
      await page.selectOption(subunitSelect, subunit);
      await page.waitForTimeout(100);
      const visibleRows = await page.evaluate((prefix) => {
        return Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`))
          .map((el) => (el.getAttribute('data-testid') || '').replace(prefix, ''))
          .filter((value) => value.length > 0)
          .sort();
      }, chainRowPrefix);

      const expectedRows = [...(expectedBySubunit[subunit] ?? [])].sort();
      expect(visibleRows).toEqual(expectedRows);
    }
  };

  await assertViewerSubunitRowsMatchDiagnostics(
    '#viewer-column-A-alignedto-subunit-select',
    'viewer-column-A-chain-table-row-',
    data.alignedTo.subunitToChainIds
  );
  await assertViewerSubunitRowsMatchDiagnostics(
    '#viewer-column-B-aligned-subunit-select',
    'viewer-column-B-chain-table-row-',
    data.aligned.subunitToChainIds
  );
});
