import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

async function loadAlignedToDataset(page: Page) {
  await page.goto('/');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });
}

async function openRepresentationControls(page: Page) {
  const toggle = page.locator('#viewer-column-A-alignedto-representation-controls-toggle-btn');
  if (!(await toggle.isVisible())) {
    await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
    await expect(toggle).toBeVisible({ timeout: 20000 });
  }

  const colorModeSelect = page.locator('#viewer-column-A-alignedto-color-mode-select');
  if (!(await colorModeSelect.isVisible())) {
    await toggle.click();
    await expect(colorModeSelect).toBeVisible({ timeout: 20000 });
  }
}

async function uploadChainTheme(page: Page) {
  const content = ['chain,color', 'CU,#12AB34', 'LY,#34CD56'].join('\n');
  await page.setInputFiles('#viewer-column-A-alignedto-chain-colours-file-input', {
    name: 'chain-theme-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf-8'),
  });

  await expect.poll(async () => {
    return page.locator('#viewer-column-A-alignedto-chain-colour-theme-select option', { hasText: 'chain-theme-e2e' }).count();
  }, { timeout: 10000 }).toBeGreaterThan(0);
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { label: 'chain-theme-e2e' });
}

async function uploadResidueTheme(page: Page) {
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'residue-type');
  await expect(page.locator('#viewer-column-A-alignedto-residue-colours-file-input')).toBeAttached({ timeout: 10000 });

  const content = ['residue_type,color', 'ALA,#CC5500', 'GLY,#0088AA'].join('\n');
  await page.setInputFiles('#viewer-column-A-alignedto-residue-colours-file-input', {
    name: 'residue-theme-e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(content, 'utf-8'),
  });

  await expect.poll(async () => {
    return page.locator('#viewer-column-A-alignedto-residue-colour-theme-select option', { hasText: 'residue-theme-e2e' }).count();
  }, { timeout: 10000 }).toBeGreaterThan(0);
  await page.selectOption('#viewer-column-A-alignedto-residue-colour-theme-select', { label: 'residue-theme-e2e' });
}

async function saveAllAndGetSession(page: Page): Promise<{ path: string; json: any }> {
  await expect(page.locator('#session-menu-btn')).toBeVisible({ timeout: 30000 });
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

  const text = await fs.readFile(downloadedPath as string, 'utf-8');
  const json = JSON.parse(text);
  return { path: downloadedPath as string, json };
}

async function loadAllFromSession(page: Page, sessionPath: string) {
  await page.setInputFiles('#session-menu-file-input-all', sessionPath);
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });
}

test('Save All/Load All restores separate chain and residue theme selections', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  await uploadChainTheme(page);
  await uploadResidueTheme(page);

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await expect(page.locator('#viewer-column-A-alignedto-chain-colour-theme-select')).toBeVisible({ timeout: 10000 });

  const chainThemeValueBefore = await page.locator('#viewer-column-A-alignedto-chain-colour-theme-select').inputValue();

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'residue-type');
  await expect(page.locator('#viewer-column-A-alignedto-residue-colour-theme-select')).toBeVisible({ timeout: 10000 });
  const residueThemeValueBefore = await page.locator('#viewer-column-A-alignedto-residue-colour-theme-select').inputValue();

  expect(chainThemeValueBefore).not.toBe('default');
  expect(residueThemeValueBefore).not.toBe('default');
  expect(chainThemeValueBefore).not.toBe(residueThemeValueBefore);

  const saved = await saveAllAndGetSession(page);

  expect(saved.json?.uiState?.colorThemesByMode?.alignedTo?.selectedChainThemeName).toBe(chainThemeValueBefore);
  expect(saved.json?.uiState?.colorThemesByMode?.alignedTo?.selectedResidueThemeName).toBe(residueThemeValueBefore);

  await loadAllFromSession(page, saved.path);
  await openRepresentationControls(page);

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await expect.poll(async () => page.locator('#viewer-column-A-alignedto-chain-colour-theme-select').inputValue(), { timeout: 20000 })
    .toBe(chainThemeValueBefore);

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'residue-type');
  await expect.poll(async () => page.locator('#viewer-column-A-alignedto-residue-colour-theme-select').inputValue(), { timeout: 20000 })
    .toBe(residueThemeValueBefore);
});
