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

test('Save All/Load All restores dynamic Select 4 chain selections in both columns', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('http://localhost:5173/');
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

  const sessionFilePath = await saveAllAndDownloadSession(page);
  await loadAllFromSessionFile(page, sessionFilePath);

  await ensureSelectZoomControlsOpen(page, 'A');
  await ensureSelectZoomControlsOpen(page, 'B');
  await ensureChainControlsOpen(page, 'A');
  await ensureChainControlsOpen(page, 'B');

  await expect(page.locator('#viewer-column-A-alignedto-selected-chain4-label')).toContainText(chain4A, { timeout: 20000 });
  await expect(page.locator('#viewer-column-B-aligned-selected-chain4-label')).toContainText(chain4B, { timeout: 20000 });
});

test('Save All/Load All preserves Select 4 clear cascade so Select 5 is hidden', async ({ page }) => {
  test.setTimeout(180000);

  await page.goto('http://localhost:5173/');
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
