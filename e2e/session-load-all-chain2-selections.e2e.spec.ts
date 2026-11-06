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

async function loadAlignedToAndAligned(page: Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });

  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toBeVisible({ timeout: 60000 });
}

async function selectFirstResidue(page: Page, selectSelector: string): Promise<string> {
  const value = await page.evaluate((selector) => {
    const select = document.querySelector(selector) as HTMLSelectElement | null;
    if (!select || !select.options || select.options.length === 0) return '';
    return (select.options[0]?.value || '').trim();
  }, selectSelector);
  expect(value).not.toBe('');
  await page.selectOption(selectSelector, value);
  return value;
}

async function getSelectedResidueValues(page: Page, selectSelector: string): Promise<string[]> {
  return await page.evaluate((selector) => {
    const select = document.querySelector(selector) as HTMLSelectElement | null;
    if (!select) return [];
    return Array.from(select.selectedOptions).map((option) => option.value);
  }, selectSelector);
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

async function setupSelections(page: Page) {
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

  const chain1A = await selectFirstRowAndGetChainId(page, 'viewer-column-A-chain-table-row-');
  const chain1B = await selectFirstRowAndGetChainId(page, 'viewer-column-B-chain-table-row-');
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).toContainText(chain1A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain-label')).toContainText(chain1B, { timeout: 15000 });

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

  const chain2A = await selectFirstRowAndGetChainId(page, 'viewer-column-A-alignedto-chain2-chain-table-row-');
  const chain2B = await selectFirstRowAndGetChainId(page, 'viewer-column-B-aligned-chain2-chain-table-row-');
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain2-label')).toContainText(chain2A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain2-label')).toContainText(chain2B, { timeout: 15000 });

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-residue-controls-toggle-btn',
    '#viewer-column-A-alignedto-residue-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-residue-controls-toggle-btn',
    '#viewer-column-B-aligned-residue-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-residue2-controls-toggle-btn',
    '#viewer-column-A-alignedto-residue2-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-residue2-controls-toggle-btn',
    '#viewer-column-B-aligned-residue2-select'
  );

  await expect(page.locator('#viewer-column-A-alignedto-residue-select')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-residue-select')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('#viewer-column-A-alignedto-residue2-select')).toBeEnabled({ timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-residue2-select')).toBeEnabled({ timeout: 15000 });

  const residueA = await selectFirstResidue(page, '#viewer-column-A-alignedto-residue-select');
  const residueB = await selectFirstResidue(page, '#viewer-column-B-aligned-residue-select');
  const residue2A = await selectFirstResidue(page, '#viewer-column-A-alignedto-residue2-select');
  const residue2B = await selectFirstResidue(page, '#viewer-column-B-aligned-residue2-select');

  return { chain1A, chain1B, chain2A, chain2B, residueA, residueB, residue2A, residue2B };
}

async function captureSelectionSnapshot(page: Page) {
  const chain1LabelA = (await page.locator('#viewer-column-A-alignedto-selected-chain-label').textContent())?.trim() ?? '';
  const chain2LabelA = (await page.locator('#viewer-column-A-alignedto-selected-chain2-label').textContent())?.trim() ?? '';
  const chain1LabelB = (await page.locator('#viewer-column-B-aligned-selected-chain-label').textContent())?.trim() ?? '';
  const chain2LabelB = (await page.locator('#viewer-column-B-aligned-selected-chain2-label').textContent())?.trim() ?? '';
  const residueSummaryText = (await page.locator('#generalcontrols-realign-residue-btn').textContent())?.trim() ?? '';
  const residueSummaryEnabled = await page.locator('#generalcontrols-realign-residue-btn').isEnabled();

  const residueValuesA = await getSelectedResidueValues(page, '#viewer-column-A-alignedto-residue-select');
  const residue2ValuesA = await getSelectedResidueValues(page, '#viewer-column-A-alignedto-residue2-select');
  const residueValuesB = await getSelectedResidueValues(page, '#viewer-column-B-aligned-residue-select');
  const residue2ValuesB = await getSelectedResidueValues(page, '#viewer-column-B-aligned-residue2-select');

  return {
    chain1LabelA,
    chain2LabelA,
    chain1LabelB,
    chain2LabelB,
    residueValuesA,
    residue2ValuesA,
    residueValuesB,
    residue2ValuesB,
    residueSummaryText,
    residueSummaryEnabled,
  };
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
  await expect(page.locator('#viewer-column-A-toggle-visibility-btn').first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });
}

test('Save All and Load All restores Chain 1 and Chain 2 chain and residue selections in both columns', async ({ page }) => {
  test.setTimeout(150000);

  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);

  const selectedChains = await setupSelections(page);
  const beforeSave = await captureSelectionSnapshot(page);

  expect(beforeSave.chain1LabelA).toContain(selectedChains.chain1A);
  expect(beforeSave.chain2LabelA).toContain(selectedChains.chain2A);
  expect(beforeSave.chain1LabelB).toContain(selectedChains.chain1B);
  expect(beforeSave.chain2LabelB).toContain(selectedChains.chain2B);
  expect(beforeSave.residueValuesA).toEqual([selectedChains.residueA]);
  expect(beforeSave.residue2ValuesA).toEqual([selectedChains.residue2A]);
  expect(beforeSave.residueValuesB).toEqual([selectedChains.residueB]);
  expect(beforeSave.residue2ValuesB).toEqual([selectedChains.residue2B]);
  expect(beforeSave.residueSummaryEnabled).toBe(true);

  const sessionFilePath = await saveAllAndDownloadSession(page);

  await loadAllFromSessionFile(page, sessionFilePath);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).toContainText(selectedChains.chain1A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain-label')).toContainText(selectedChains.chain1B, { timeout: 15000 });
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain2-label')).toContainText(selectedChains.chain2A, { timeout: 15000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain2-label')).toContainText(selectedChains.chain2B, { timeout: 15000 });

  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-residue-controls-toggle-btn',
    '#viewer-column-A-alignedto-residue-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-residue-controls-toggle-btn',
    '#viewer-column-B-aligned-residue-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-A-alignedto-residue2-controls-toggle-btn',
    '#viewer-column-A-alignedto-residue2-select'
  );
  await ensureSectionOpen(
    page,
    '#viewer-column-B-aligned-residue2-controls-toggle-btn',
    '#viewer-column-B-aligned-residue2-select'
  );

  const afterLoad = await captureSelectionSnapshot(page);

  expect(afterLoad.chain1LabelA).toBe(beforeSave.chain1LabelA);
  expect(afterLoad.chain2LabelA).toBe(beforeSave.chain2LabelA);
  expect(afterLoad.chain1LabelB).toBe(beforeSave.chain1LabelB);
  expect(afterLoad.chain2LabelB).toBe(beforeSave.chain2LabelB);
  expect(afterLoad.residueValuesA).toEqual(beforeSave.residueValuesA);
  expect(afterLoad.residue2ValuesA).toEqual(beforeSave.residue2ValuesA);
  expect(afterLoad.residueValuesB).toEqual(beforeSave.residueValuesB);
  expect(afterLoad.residue2ValuesB).toEqual(beforeSave.residue2ValuesB);
  expect(afterLoad.residueSummaryText).toBe(beforeSave.residueSummaryText);
  expect(afterLoad.residueSummaryEnabled).toBe(beforeSave.residueSummaryEnabled);
});
