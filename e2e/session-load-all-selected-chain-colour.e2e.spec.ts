import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import { dataPath } from './helpers/session-load';

async function loadAlignedToDataset(page: Page) {
  await page.goto('http://localhost:5173/');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });
}

async function openAlignedToControls(page: Page) {
  const chainControlsToggle = page.locator('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  if (!(await chainControlsToggle.isVisible())) {
    await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
    await expect(chainControlsToggle).toBeVisible({ timeout: 20000 });
  }

  const selectChainToggle = page.locator('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  if (!(await selectChainToggle.isVisible())) {
    await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
    await expect(selectChainToggle).toBeVisible({ timeout: 20000 });
  }

  const chainRows = page.locator('[data-testid^="viewer-column-A-chain-table-row-"]');
  if ((await chainRows.count()) === 0) {
    await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
    await expect.poll(async () => chainRows.count(), { timeout: 20000 }).toBeGreaterThan(0);
  }
}

async function ensureSelectedChainColorControlVisible(page: Page, chainId: string) {
  const selectedChainColor = page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}`);
  if (await selectedChainColor.isVisible()) return;
  await page.click('#viewer-column-A-alignedto-representation-controls-toggle-btn');
  await expect(selectedChainColor).toBeVisible({ timeout: 20000 });
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

async function setSelectedChainColor(page: Page, chainId: string, color: string) {
  await page.locator(`#viewer-column-A-alignedto-chain-color-${chainId}`).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.value = value as string;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
  await page.click(`#viewer-column-A-alignedto-chain-color-${chainId}-apply-btn`);
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
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });
}

test('Save All and Load All preserves selected-chain colour and rendered theme for selected chain', async ({ page }) => {
  test.setTimeout(150000);

  await loadAlignedToDataset(page);
  await openAlignedToControls(page);

  const selectedChain = await selectTargetChain(page);
  await ensureSelectedChainColorControlVisible(page, selectedChain);
  const chosenColor = '#12AB34';

  await setSelectedChainColor(page, selectedChain, chosenColor);
  const beforeSaveTheme = await saveThemeCsv(page);
  expect(beforeSaveTheme.get(selectedChain)).toBe(chosenColor);

  const sessionFilePath = await saveAllAndDownloadSession(page);
  await loadAllFromSessionFile(page, sessionFilePath);

  await openAlignedToControls(page);
  await expect(page.locator('#viewer-column-A-alignedto-selected-chain-label')).toContainText(selectedChain, { timeout: 15000 });
  await ensureSelectedChainColorControlVisible(page, selectedChain);

  await expect.poll(async () => {
    const value = await page.locator(`#viewer-column-A-alignedto-chain-color-${selectedChain}`).inputValue();
    return value.toUpperCase();
  }, { timeout: 20000 }).toBe(chosenColor);

  const afterLoadTheme = await saveThemeCsv(page);
  expect(afterLoadTheme.get(selectedChain)).toBe(chosenColor);
});
