/**
 * Playwright E2E regression for session load and all dynamic chain slots behavior.
 *
 * Covers: 4ug0.cif and 6xu8.cif datasets, chain selection, and dynamic chain slot interactions.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.3.0
 * @lastModified 2026-11-26
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

test.use({
  launchOptions: {
    args: [
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  },
});

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function ensureSectionOpen(page: Page, toggleSelector: string, contentSelector: string) {
  const content = page.locator(contentSelector).first();
  if (await content.isVisible()) return;
  await page.click(toggleSelector);
  if (await content.isVisible()) return;
  await page.click(toggleSelector);
  await expect(content).toBeVisible({ timeout: 15000 });
}

async function ensureSelectZoomControlsOpen(page: Page, viewer: 'A' | 'B') {
  const mode = viewer === 'A' ? 'alignedto' : 'aligned';
  const chainControlsToggle = page.locator(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
  if (await chainControlsToggle.isVisible()) return;
  await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
  await expect(chainControlsToggle).toBeVisible({ timeout: 20000 });
}

async function ensureChainControlsOpen(page: Page, viewer: 'A' | 'B') {
  const mode = viewer === 'A' ? 'alignedto' : 'aligned';
  const selectChainToggle = page.locator(`#viewer-column-${viewer}-${mode}-select-chain-controls-toggle-btn`);
  if (await selectChainToggle.isVisible()) return;
  await page.click(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
  await expect(selectChainToggle).toBeVisible({ timeout: 20000 });
}

async function selectFirstRowAndGetChainId(page: Page, rowPrefix: string): Promise<string> {
  const rows = page.locator(`[data-testid^="${rowPrefix}"]`);
  await expect.poll(async () => rows.count(), { timeout: 30000 }).toBeGreaterThan(0);
  const first = rows.first();
  const testId = (await first.getAttribute('data-testid')) || '';
  const chainId = testId.replace(rowPrefix, '');
  await first.click();
  return chainId;
}

async function loadAlignedToAndAligned(page: Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });

  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toBeVisible({ timeout: 60000 });
}

async function saveAllAndDownloadSession(page: Page): Promise<string> {
  await expect(page.locator('#session-menu-btn')).toBeVisible({ timeout: 45000 });
  await page.click('#session-menu-btn');
  await page.waitForSelector('#session-menu-dropdown', { state: 'visible' });
  await page.evaluate(() => {
    try {
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
    } catch {
      (window as any).showSaveFilePicker = undefined;
    }
  });

  const downloadPromise = page.waitForEvent('download');
  await page.click('#session-menu-dropdown .session-menu-item:text-is("Save All")');
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  return downloadedPath as string;
}

async function loadAllFromSessionFile(page: Page, sessionFilePath: string) {
  await page.setInputFiles('#session-menu-file-input-all', sessionFilePath);
  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible({ timeout: 60000 });
}

test('Save All/Load All restores dynamic chain and residue selections in both columns', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('/');
  await loadAlignedToAndAligned(page);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain-controls-toggle-btn',
    '#viewer-column-A-chain-table-container'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain-controls-toggle-btn',
    '#viewer-column-B-chain-table-container'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain2-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain2-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain2-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain2-chain-table-row-"]'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain2-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain2-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain3-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain3-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain3-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain3-chain-table-row-"]'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain3-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain3-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain4-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain4-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain4-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain4-chain-table-row-"]'
  );
  const chain4A = await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain4-chain-table-row-');
  const chain4B = await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain4-chain-table-row-');

  await expect(page.locator('#viewer-column-A-alignedto-selected-chain4-label')).toContainText(chain4A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain4-label')).toContainText(chain4B, { timeout: 15000 });

  const chain5: string[] = [];
  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    const prefix = `viewer-column-${viewer}-${mode}`;
    await ensureSectionOpen(page, `#${prefix}-select-chain5-controls-toggle-btn`, `[data-testid^="${prefix}-chain5-chain-table-row-"]`);
    chain5.push(await selectFirstRowAndGetChainId(page, `${prefix}-chain5-chain-table-row-`));
  }

  const selectedResidues = new Map<string, string[]>();
  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    for (const slot of [4, 5]) {
      const prefix = `viewer-column-${viewer}-${mode}`;
      const residueToggle = page.locator(`#${prefix}-residue${slot}-controls-toggle-btn`);
      await expect(residueToggle).toBeVisible({ timeout: 10000 });
      await residueToggle.click();
      const select = page.locator(`#${prefix}-residue${slot}-select`);
      await expect.poll(() => select.locator('option').count(), { timeout: 30000 }).toBeGreaterThan(1);
      const values = viewer === 'B' && slot === 5 ? [] : await select.locator('option').evaluateAll(options =>
        options.slice(0, 2).map(option => (option as HTMLOptionElement).value));
      await select.selectOption(values);
      await expect(select.locator('option:checked')).toHaveCount(values.length);
      selectedResidues.set(`${viewer}-${slot}`, values);
    }
    for (const slot of [1, 2, 3]) {
      const suffix = slot === 1 ? '' : String(slot);
      const prefix = `viewer-column-${viewer}-${mode}`;
      const toggle = page.locator(`#${prefix}-residue${suffix}-controls-toggle-btn`);
      const select = page.locator(`#${prefix}-residue${suffix}-select`);
      if (!await select.isVisible()) await toggle.click();
      await expect.poll(() => select.locator('option').count(), { timeout: 30000 }).toBeGreaterThan(0);
      await select.selectOption([]);
      await expect(select.locator('option:checked')).toHaveCount(0);
    }
  }

  const sessionFilePath = await saveAllAndDownloadSession(page);
  await loadAllFromSessionFile(page, sessionFilePath);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await expect(page.locator('#viewer-column-A-alignedto-selected-chain4-label')).toContainText(chain4A, { timeout: 20000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain4-label')).toContainText(chain4B, { timeout: 20000 });
  for (const [index, [viewer, mode]] of ([['A', 'alignedto'], ['B', 'aligned']] as const).entries()) {
    const prefix = `viewer-column-${viewer}-${mode}`;
    await expect(page.locator(`#${prefix}-selected-chain5-label`)).toContainText(chain5[index], { timeout: 20000 });
    for (const slot of [1, 2, 3]) {
      const suffix = slot === 1 ? '' : String(slot);
      const chainToggle = page.locator(`#${prefix}-select-chain${suffix}-controls-toggle-btn`);
      const residueToggle = page.locator(`#${prefix}-residue${suffix}-controls-toggle-btn`);
      if (!await residueToggle.isVisible()) await chainToggle.click();
      const select = page.locator(`#${prefix}-residue${suffix}-select`);
      if (!await select.isVisible()) await residueToggle.click();
      await expect.poll(() => select.locator('option').count(), { timeout: 30000 }).toBeGreaterThan(0);
      await expect(select.locator('option:checked')).toHaveCount(0);
    }
    for (const slot of [4, 5]) {
      const chainToggle = page.locator(`#${prefix}-select-chain${slot}-controls-toggle-btn`);
      const residueToggle = page.locator(`#${prefix}-residue${slot}-controls-toggle-btn`);
      if (!await residueToggle.isVisible()) await chainToggle.click();
      const select = page.locator(`#${prefix}-residue${slot}-select`);
      if (!await select.isVisible()) await residueToggle.click();
      await expect.poll(() => select.locator('option:checked').evaluateAll(options =>
        options.map(option => (option as HTMLOptionElement).value)), { timeout: 30000 })
        .toEqual(selectedResidues.get(`${viewer}-${slot}`));
    }
  }
});

test('reorders selections independently across all slots and preserves them in a session', async ({ page }) => {
  test.setTimeout(240000);
  await page.goto('/');
  await loadAlignedToAndAligned(page);
  const datasets = [['A', 'alignedto'], ['B', 'aligned']] as const;
  const expected = new Map<string, Array<{ chain: string; residues: string[] }>>();
  for (const [viewer, mode] of datasets) {
    const prefix = `viewer-column-${viewer}-${mode}`;
    await ensureSelectZoomControlsOpen(page, viewer);
    await ensureChainControlsOpen(page, viewer);
    const selections: Array<{ chain: string; residues: string[] }> = [];
    for (let slot = 1; slot <= 5; slot++) {
      const suffix = slot === 1 ? '' : String(slot);
      const rowPrefix = slot === 1 ? `viewer-column-${viewer}-chain-table-row-` : `${prefix}-chain${slot}-chain-table-row-`;
      await ensureSectionOpen(page, `#${prefix}-select-chain${suffix}-controls-toggle-btn`, `[data-testid^="${rowPrefix}"]`);
      const chain = await selectFirstRowAndGetChainId(page, rowPrefix);
      const residueToggle = page.locator(`#${prefix}-residue${suffix}-controls-toggle-btn`);
      const select = page.locator(`#${prefix}-residue${suffix}-select`);
      if (!await select.isVisible()) await residueToggle.click();
      await expect.poll(() => select.locator('option').count(), { timeout: 30000 }).toBeGreaterThan(0);
      const residues = slot === 3 ? [] : await select.locator('option').evaluateAll(options =>
        options.slice(0, 1).map(option => (option as HTMLOptionElement).value));
      await select.selectOption(residues);
      selections.push({ chain, residues });
    }
    expected.set(viewer, selections);
  }
  const assertSelections = async (viewer: 'A' | 'B', mode: 'alignedto' | 'aligned') => {
    const prefix = `viewer-column-${viewer}-${mode}`;
    const selections = expected.get(viewer)!;
    for (const [index, item] of selections.entries()) {
      const slot = index + 1;
      const suffix = slot === 1 ? '' : String(slot);
      await expect(page.locator(`#${prefix}-selected-chain${suffix}-label`)).toContainText(item.chain, { timeout: 30000 });
      const toggle = page.locator(`#${prefix}-residue${suffix}-controls-toggle-btn`);
      if (!await toggle.isVisible()) await page.locator(`#${prefix}-select-chain${suffix}-controls-toggle-btn`).click();
      const select = page.locator(`#${prefix}-residue${suffix}-select`);
      if (!await select.isVisible()) await toggle.click();
      await expect.poll(() => select.locator('option:checked').evaluateAll(options =>
        options.map(option => (option as HTMLOptionElement).value)), { timeout: 30000 }).toEqual(item.residues);
    }
  };
  for (const [viewer, mode] of datasets) {
    const prefix = `viewer-column-${viewer}-${mode}`;
    const selections = expected.get(viewer)!;
    for (const [slot, direction] of [[1, 'down'], [4, 'up'], [5, 'up']] as const) {
      await page.locator(`#${prefix}-move-chain${slot}-${direction}-btn`).click();
      const index = slot - 1;
      const target = index + (direction === 'up' ? -1 : 1);
      [selections[index], selections[target]] = [selections[target], selections[index]];
      await assertSelections(viewer, mode);
    }
    if (viewer === 'A') await assertSelections('B', 'aligned');
  }
  const leftSelect = page.locator('#viewer-column-A-alignedto-residue3-select');
  const rightSelect = page.locator('#viewer-column-B-aligned-residue3-select');
  const leftIds = await leftSelect.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
  const rightIds = new Set(await rightSelect.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value)));
  const common = leftIds.filter(id => rightIds.has(id));
  if (common.length > 0) {
    await page.locator('#viewer-column-A-alignedto-residue3-select-common-btn').click();
    await expect.poll(() => leftSelect.locator('option:checked').evaluateAll(options =>
      options.map(option => (option as HTMLOptionElement).value))).toEqual(common);
    await leftSelect.selectOption(expected.get('A')![2].residues);
  } else {
    await expect(page.locator('#viewer-column-A-alignedto-residue3-select-common-btn')).toBeDisabled();
  }
  const session = await saveAllAndDownloadSession(page);
  await loadAllFromSessionFile(page, session);
  for (const [viewer, mode] of datasets) {
    await ensureSelectZoomControlsOpen(page, viewer);
    await ensureChainControlsOpen(page, viewer);
    await assertSelections(viewer, mode);
  }
});

test('Save All/Load All preserves Select 4 clear cascade so Select 5 is hidden', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('/');
  await loadAlignedToAndAligned(page);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain-controls-toggle-btn',
    '#viewer-column-A-chain-table-container'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain-controls-toggle-btn',
    '#viewer-column-B-chain-table-container'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain2-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain2-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain2-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain2-chain-table-row-"]'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain2-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain2-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain3-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain3-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain3-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain3-chain-table-row-"]'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain3-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain3-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain4-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain4-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain4-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain4-chain-table-row-"]'
  );
  await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain4-chain-table-row-');
  await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain4-chain-table-row-');

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-select-chain5-controls-toggle-btn',
    '[data-testid^="viewer-column-A-alignedto-chain5-chain-table-row-"]'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-select-chain5-controls-toggle-btn',
    '[data-testid^="viewer-column-B-aligned-chain5-chain-table-row-"]'
  );
  const chain5A = await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain5-chain-table-row-');
  const chain5B = await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain5-chain-table-row-');
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain5-label')).toContainText(chain5A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain5-label')).toContainText(chain5B, { timeout: 15000 });

  await page.click('#viewer-column-A-alignedto-clear-chain4-selection-btn');
  await page.click('#viewer-column-B-aligned-clear-chain4-selection-btn');
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain4-label')).toContainText('None', { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain4-label')).toContainText('None', { timeout: 15000 });
  await expect(page.locator('#viewer-column-A-alignedto-select-chain5-controls-toggle-btn')).toHaveCount(0);
  await expect(page.locator('#viewer-column-B-aligned-select-chain5-controls-toggle-btn')).toHaveCount(0);

  const sessionFilePath = await saveAllAndDownloadSession(page);
  await loadAllFromSessionFile(page, sessionFilePath);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await expect(page.locator('#viewer-column-A-alignedto-selected-chain4-label')).toContainText('None', { timeout: 20000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain4-label')).toContainText('None', { timeout: 20000 });
  await expect(page.locator('#viewer-column-A-alignedto-select-chain5-controls-toggle-btn')).toHaveCount(0);
  await expect(page.locator('#viewer-column-B-aligned-select-chain5-controls-toggle-btn')).toHaveCount(0);
});
