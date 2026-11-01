import { test, expect, type Page, type Browser } from '@playwright/test';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

if (process.env.PW_E2E_FORCE_WEBGL === '1') {
  test.describe.configure({ retries: 1 });
}

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

type RepThemeState = {
  repId?: string;
  colorThemeName?: string;
  effectiveColorThemeName?: string;
  chainThemeName?: string;
  residueThemeName?: string;
  activeThemeKind?: 'chain' | 'residue-type';
};

type MoleculeMode = 'AlignedTo' | 'Aligned';

async function gotoWithRetry(page: Page, url: string, attempts = 3) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      return;
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await page.waitForTimeout(500);
      }
    }
  }
  throw lastError;
}

async function loadAlignedToDataset(page: Page) {
  await gotoWithRetry(page, '/');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });
}

async function openRepresentationControls(page: Page) {
  const repToggle = page.locator('#viewer-column-A-alignedto-representation-controls-toggle-btn');
  if (!(await repToggle.isVisible())) {
    await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
    await expect(repToggle).toBeVisible({ timeout: 15000 });
  }
  const aria = (await repToggle.getAttribute('aria-label')) ?? '';
  if (aria.includes('Show Representation Controls')) {
    await repToggle.click();
  }
}

async function firstRepThemeSelectors(page: Page) {
  const kindSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-theme-kind-"]').first();
  const chainSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-chain-theme-"]').first();
  const residueSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-residue-theme-"]').first();
  await expect(kindSelect).toBeVisible({ timeout: 20000 });
  const kindId = (await kindSelect.getAttribute('id')) ?? '';
  const repId = kindId.split('-rep-theme-kind-')[1] ?? '';
  return { chainSelect, residueSelect, kindSelect, repId };
}

async function addAlignedToRepresentation(page: Page, type = 'spacefill') {
  await page.getByRole('combobox', { name: 'Add Representation' }).selectOption(type);
  await page.getByRole('button', { name: 'Add Representation' }).click();
}

async function latestRepThemeSelectors(page: Page) {
  const kindSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-theme-kind-"]').last();
  const chainSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-chain-theme-"]').last();
  const residueSelect = page.locator('select[id^="viewer-column-A-"][id*="-rep-residue-theme-"]').last();
  await expect(kindSelect).toBeVisible({ timeout: 20000 });
  const kindId = (await kindSelect.getAttribute('id')) ?? '';
  const repId = kindId.split('-rep-theme-kind-')[1] ?? '';
  return { chainSelect, residueSelect, kindSelect, repId };
}

async function uploadChainTheme(page: Page, fileName = '4ug0-chain-colours-alan.csv') {
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.setInputFiles('#viewer-column-A-alignedto-chain-colours-file-input', dataPath(fileName));
  const label = fileName.replace(/\.[^.]+$/, '');
  await expect.poll(async () => {
    return page.locator('#viewer-column-A-alignedto-chain-colour-theme-select option', { hasText: label }).count();
  }, { timeout: 15000 }).toBeGreaterThan(0);
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { label });
  const value = await page.locator('#viewer-column-A-alignedto-chain-colour-theme-select').inputValue();
  return { label, value };
}

async function getDefaultResidueColorSamples(page: Page, mode: 'AlignedTo' | 'Aligned', viewerKey: 'A' | 'B', limit = 24) {
  return await page.evaluate(({ targetMode, targetViewerKey, targetLimit }) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getDefaultResidueColorSamples) return [];
    const rows = api.getDefaultResidueColorSamples(targetMode, targetViewerKey, targetLimit) || [];
    return Array.isArray(rows) ? rows : [];
  }, { targetMode: mode, targetViewerKey: viewerKey, targetLimit: limit });
}

async function captureViewerAVisualHash(page: Page): Promise<string> {
  const viewerAColumn = page.locator('#viewer-column-A-alignedto-representation-controls-toggle-btn').locator('xpath=ancestor::div[contains(@id, "viewer-column-A")]').first();
  await expect(viewerAColumn).toBeVisible({ timeout: 20000 });
  const molstarContainer = viewerAColumn.locator('[id$="-molstar-container"]').first();
  await expect(molstarContainer).toBeVisible({ timeout: 20000 });
  const png = await molstarContainer.screenshot();
  return crypto.createHash('sha256').update(png).digest('hex');
}

async function captureViewerAVisualPng(page: Page): Promise<Buffer> {
  const viewerAColumn = page.locator('#viewer-column-A-alignedto-representation-controls-toggle-btn').locator('xpath=ancestor::div[contains(@id, "viewer-column-A")]').first();
  await expect(viewerAColumn).toBeVisible({ timeout: 20000 });
  const molstarContainer = viewerAColumn.locator('[id$="-molstar-container"]').first();
  await expect(molstarContainer).toBeVisible({ timeout: 20000 });
  let previousHash = '';
  let previousPng: Buffer | null = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    const png = await molstarContainer.screenshot();
    const hash = crypto.createHash('sha256').update(png).digest('hex');
    if (hash === previousHash && previousPng) {
      return png;
    }
    previousHash = hash;
    previousPng = png;
    await page.waitForTimeout(120);
  }
  return previousPng ?? await molstarContainer.screenshot();
}

async function assertWebGLAvailable(page: Page) {
  const warning = page.getByText('WebGL does not seem to be available.');
  const count = await warning.count();
  if (count === 0) return;
  if (process.env.PW_E2E_FORCE_WEBGL === '1') {
    await expect(warning).toHaveCount(0);
    return;
  }
  test.skip(true, 'Skipping WebGL visual regression checks because WebGL is unavailable in this run.');
}

async function runScenarioAndGetViewerAHash(browser: Browser, scenario: 'residue-custom-then-default' | 'residue-default-direct') {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loadAlignedToDataset(page);
    await openRepresentationControls(page);
    await assertWebGLAvailable(page);

    if (scenario === 'residue-custom-then-default') {
      // User flow 1: set Representation Controls Theme to Residue and load the
      // residue theme file before changing representation Theme Type.
      const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');
      const { kindSelect } = await firstRepThemeSelectors(page);
      await kindSelect.selectOption('residue-type');
      const residueSelectors = await firstRepThemeSelectors(page);
      await expect(residueSelectors.residueSelect).toBeVisible({ timeout: 10000 });
      await residueSelectors.residueSelect.selectOption({ label: residueTheme.label });
      await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, residueSelectors.repId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);
      await residueSelectors.residueSelect.selectOption({ label: 'Default' });
      await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, residueSelectors.repId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
    } else {
      const { kindSelect } = await firstRepThemeSelectors(page);
      await kindSelect.selectOption('residue-type');
      const residueSelectors = await firstRepThemeSelectors(page);
      await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, residueSelectors.repId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
    }

    return await captureViewerAVisualHash(page);
  } finally {
    await context.close();
  }
}

async function runScenarioAndGetFinalRepState(browser: Browser, scenario: 'residue-custom-then-default' | 'residue-default-direct') {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loadAlignedToDataset(page);
    await openRepresentationControls(page);
    await assertWebGLAvailable(page);

    let repId = '';
    if (scenario === 'residue-custom-then-default') {
      // User flow 1: set Representation Controls Theme to Residue and load the
      // residue theme file before changing representation Theme Type.
      const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');
      const selectors = await firstRepThemeSelectors(page);
      await selectors.kindSelect.selectOption('residue-type');
      const residueSelectors = await firstRepThemeSelectors(page);
      repId = residueSelectors.repId;
      await expect(residueSelectors.residueSelect).toBeVisible({ timeout: 10000 });
      await residueSelectors.residueSelect.selectOption({ label: residueTheme.label });
      await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);
      await residueSelectors.residueSelect.selectOption({ label: 'Default' });
    } else {
      const selectors = await firstRepThemeSelectors(page);
      await selectors.kindSelect.selectOption('residue-type');
      repId = (await firstRepThemeSelectors(page)).repId;
    }

    await expect.poll(async () => {
      const state = await getAlignedToRepThemeStateWithFallback(page, repId);
      return state?.colorThemeName;
    }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
    const finalState = await getAlignedToRepThemeStateWithFallback(page, repId);
    return {
      state: finalState,
      hash: await captureViewerAVisualHash(page),
    };
  } finally {
    await context.close();
  }
}

async function runScenarioAndCapture(browser: Browser, scenario: 'residue-custom-then-default' | 'residue-default-direct') {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await loadAlignedToDataset(page);
    await openRepresentationControls(page);
    await assertWebGLAvailable(page);

    let repId = '';
    if (scenario === 'residue-custom-then-default') {
      const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');
      const selectors = await firstRepThemeSelectors(page);
      await selectors.kindSelect.selectOption('residue-type');
      const residueSelectors = await firstRepThemeSelectors(page);
      repId = residueSelectors.repId;
      await expect(residueSelectors.residueSelect).toBeVisible({ timeout: 10000 });
      await residueSelectors.residueSelect.selectOption({ label: residueTheme.label });
      await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);
      await residueSelectors.residueSelect.selectOption({ label: 'Default' });
    } else {
      const selectors = await firstRepThemeSelectors(page);
      await selectors.kindSelect.selectOption('residue-type');
      repId = (await firstRepThemeSelectors(page)).repId;
    }

    await expect.poll(async () => {
      const state = await getAlignedToRepThemeStateWithFallback(page, repId);
      return state?.colorThemeName;
    }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    const allStates = await page.evaluate(() => {
      const api = (window as any).__ribocodeTestApi;
      if (!api?.getRepresentationThemeStates) return [];
      const rows = api.getRepresentationThemeStates('AlignedTo') || [];
      return Array.isArray(rows) ? rows : [];
    });
    const cameraSnapshots = await page.evaluate(() => {
      const api = (window as any).__ribocodeTestApi;
      if (!api?.getCameraSnapshots) return null;
      return api.getCameraSnapshots();
    });
    const png = await captureViewerAVisualPng(page);
    const hash = crypto.createHash('sha256').update(png).digest('hex');
    return { state, allStates, cameraSnapshots, hash, png };
  } finally {
    await context.close();
  }
}

async function uploadResidueTheme(page: Page, fileName = 'residue-type-colours-example.csv') {
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'residue-type');
  await page.setInputFiles('#viewer-column-A-alignedto-residue-colours-file-input', dataPath(fileName));
  const label = fileName.replace(/\.[^.]+$/, '');
  await expect.poll(async () => {
    return page.locator('#viewer-column-A-alignedto-residue-colour-theme-select option', { hasText: label }).count();
  }, { timeout: 15000 }).toBeGreaterThan(0);
  await page.selectOption('#viewer-column-A-alignedto-residue-colour-theme-select', { label });
  const value = await page.locator('#viewer-column-A-alignedto-residue-colour-theme-select').inputValue();
  return { label, value };
}

async function getAlignedToRepThemeState(page: Page, repId?: string): Promise<RepThemeState | null> {
  return await page.evaluate((targetRepId?: string) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return null;
    const rows = api.getRepresentationThemeStates('AlignedTo') || [];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const pickPreferredRow = (items: any[]) => {
      const residueCandidates = items.filter((r: any) => {
        const kind = String(r?.activeThemeKind ?? '');
        const colorThemeName = String(r?.colorThemeName ?? '');
        return kind === 'residue-type' || (colorThemeName && colorThemeName !== 'chain-id');
      });
      const source = residueCandidates.length > 0 ? residueCandidates : items;
      return source[source.length - 1];
    };
    const row = targetRepId
      ? rows.find((r: any) => String(r?.repId ?? '') === targetRepId)
      : pickPreferredRow(rows);
    if (!row) return null;
    return {
      repId: row?.repId,
      colorThemeName: row?.colorThemeName,
      effectiveColorThemeName: row?.effectiveColorThemeName,
      chainThemeName: row?.chainThemeName,
      residueThemeName: row?.residueThemeName,
      activeThemeKind: row?.activeThemeKind,
    } as RepThemeState;
  }, repId);
}

async function getAlignedToAnyRepThemeState(page: Page): Promise<RepThemeState | null> {
  return await getAlignedToRepThemeState(page, undefined);
}

async function getAlignedToRepThemeStateWithFallback(page: Page, repId?: string): Promise<RepThemeState | null> {
  const byId = repId ? await getAlignedToRepThemeState(page, repId) : null;
  if (byId) return byId;
  return await getAlignedToAnyRepThemeState(page);
}

async function getRepThemeStateByViewerWithFallback(page: Page, viewerKey: 'A' | 'B', repId?: string): Promise<RepThemeState | null> {
  const byId = repId ? await getRepThemeStateByViewer(page, viewerKey, repId) : null;
  if (byId) return byId;
  return await getRepThemeStateByViewer(page, viewerKey);
}

async function getMirroredViewerBRepState(page: Page, viewerARepId: string): Promise<RepThemeState | null> {
  return await page.evaluate((targetRepId: string) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return null;
    const rowsA = api.getRepresentationThemeStates('AlignedTo', 'A') || [];
    const rowsB = api.getRepresentationThemeStates('Aligned', 'B') || [];
    if (!Array.isArray(rowsA) || !Array.isArray(rowsB) || rowsA.length === 0 || rowsB.length === 0) return null;
    const idx = rowsA.findIndex((r: any) => String(r?.repId ?? '') === targetRepId);
    if (idx < 0) return null;
    const rowB = rowsB[idx] ?? rowsB[rowsB.length - 1];
    if (!rowB) return null;
    return {
      repId: rowB?.repId,
      colorThemeName: rowB?.colorThemeName,
      chainThemeName: rowB?.chainThemeName,
      residueThemeName: rowB?.residueThemeName,
      activeThemeKind: rowB?.activeThemeKind,
    } as RepThemeState;
  }, viewerARepId);
}

async function ensureSyncEnabled(page: Page) {
  const syncButton = page.getByRole('button', { name: /Sync/i });
  await expect(syncButton).toBeVisible({ timeout: 20000 });
  const text = (await syncButton.textContent()) ?? '';
  if (!/Sync:\s*On/i.test(text)) {
    await syncButton.click();
    await expect(syncButton).toHaveText(/Sync:\s*On/i, { timeout: 10000 });
  }
}

async function loadAlignedDatasetInViewerB(page: Page) {
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect.poll(async () => {
    const fileLabelVisible = await page.locator('#viewer-column-B-aligned-filename-label').isVisible().catch(() => false);
    const toggleVisible = await page.locator('#viewer-column-B-toggle-visibility-btn').nth(1).isVisible().catch(() => false);
    return fileLabelVisible || toggleVisible;
  }, { timeout: 60000 }).toBe(true);
}

async function getLatestRepIdForViewerMode(page: Page, viewerKey: 'A' | 'B', mode: MoleculeMode): Promise<string> {
  const repId = await page.evaluate(({ targetViewerKey, targetMode }) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return '';
    const rows = api.getRepresentationThemeStates(targetMode, targetViewerKey) || [];
    if (!Array.isArray(rows) || rows.length === 0) return '';
    return String(rows[rows.length - 1]?.repId ?? '');
  }, { targetViewerKey: viewerKey, targetMode: mode });
  return repId;
}

async function latestRepThemeSelectorsForViewer(page: Page, viewerKey: 'A' | 'B', mode: MoleculeMode) {
  const selectorIds = await page.evaluate(({ targetViewerKey }) => {
    const prefix = `viewer-column-${targetViewerKey}-`;
    const kindCandidates = Array.from(document.querySelectorAll('select[id*="-rep-theme-kind-"]'))
      .filter((el): el is HTMLSelectElement => el instanceof HTMLSelectElement)
      .filter(el => el.id.startsWith(prefix))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
      });
    const kindEl = kindCandidates[kindCandidates.length - 1];
    if (!kindEl) {
      return { kindId: '', chainId: '', residueId: '', repId: '' };
    }
    const repId = String(kindEl.id.split('-rep-theme-kind-')[1] ?? '');
    const chainId = `${kindEl.id.replace('-rep-theme-kind-', '-rep-chain-theme-')}`;
    const residueId = `${kindEl.id.replace('-rep-theme-kind-', '-rep-residue-theme-')}`;
    return { kindId: kindEl.id, chainId, residueId, repId };
  }, { targetViewerKey: viewerKey });
  expect(selectorIds.repId).not.toBe('');
  const kindByRepId = page.locator(`select[id="${selectorIds.kindId}"]`);
  const chainByRepId = page.locator(`select[id="${selectorIds.chainId}"]`);
  const residueByRepId = page.locator(`select[id="${selectorIds.residueId}"]`);
  await expect(kindByRepId).toBeVisible({ timeout: 20000 });
  return {
    chainSelect: chainByRepId,
    residueSelect: residueByRepId,
    kindSelect: kindByRepId,
    repId: selectorIds.repId,
  };
}

async function getRepThemeStateByViewer(page: Page, viewerKey: 'A' | 'B', repId?: string): Promise<RepThemeState | null> {
  return await page.evaluate(({ targetViewerKey, targetRepId }) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return null;
    const mode = targetViewerKey === 'A' ? 'AlignedTo' : 'Aligned';
    const rows = api.getRepresentationThemeStates(mode, targetViewerKey) || [];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const pickPreferredRow = (items: any[]) => {
      const residueCandidates = items.filter((r: any) => {
        const kind = String(r?.activeThemeKind ?? '');
        const colorThemeName = String(r?.colorThemeName ?? '');
        return kind === 'residue-type' || (colorThemeName && colorThemeName !== 'chain-id');
      });
      const source = residueCandidates.length > 0 ? residueCandidates : items;
      return source[source.length - 1];
    };
    const row = targetRepId
      ? rows.find((r: any) => String(r?.repId ?? '') === targetRepId)
      : pickPreferredRow(rows);
    if (!row) return null;
    return {
      repId: row?.repId,
      colorThemeName: row?.colorThemeName,
      chainThemeName: row?.chainThemeName,
      residueThemeName: row?.residueThemeName,
      activeThemeKind: row?.activeThemeKind,
    } as RepThemeState;
  }, { targetViewerKey: viewerKey, targetRepId: repId });
}

async function getRepThemeStateByViewerIndex(page: Page, viewerKey: 'A' | 'B', indexFromEnd = 0): Promise<RepThemeState | null> {
  return await page.evaluate(({ targetViewerKey, targetIndexFromEnd }) => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return null;
    const mode = targetViewerKey === 'A' ? 'AlignedTo' : 'Aligned';
    const rows = api.getRepresentationThemeStates(mode, targetViewerKey) || [];
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const idx = Math.max(0, rows.length - 1 - Number(targetIndexFromEnd || 0));
    const row = rows[idx];
    if (!row) return null;
    return {
      repId: row?.repId,
      colorThemeName: row?.colorThemeName,
      chainThemeName: row?.chainThemeName,
      residueThemeName: row?.residueThemeName,
      activeThemeKind: row?.activeThemeKind,
    } as RepThemeState;
  }, { targetViewerKey: viewerKey, targetIndexFromEnd: indexFromEnd });
}

async function getLatestResidueLikeColorThemeForViewer(page: Page, viewerKey: 'A' | 'B'): Promise<string | undefined> {
  return await page.evaluate((targetViewerKey: 'A' | 'B') => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getRepresentationThemeStates) return undefined;
    const mode = targetViewerKey === 'A' ? 'AlignedTo' : 'Aligned';
    const rows = api.getRepresentationThemeStates(mode, targetViewerKey) || [];
    if (!Array.isArray(rows) || rows.length === 0) return undefined;
    const preferred = rows.filter((r: any) => {
      const kind = String(r?.activeThemeKind ?? '');
      const name = String(r?.colorThemeName ?? '');
      return kind === 'residue-type' || (name && name !== 'chain-id');
    });
    const source = preferred.length > 0 ? preferred : rows;
    const row = source[source.length - 1];
    return row?.colorThemeName ? String(row.colorThemeName) : undefined;
  }, viewerKey);
}

test('representation theme switch applies selected residue theme and returns to default residue theme correctly', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueTheme = await uploadResidueTheme(page);

  // Make sure chain theme is active globally before switching representation Theme Type.
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const { chainSelect, kindSelect, repId } = await firstRepThemeSelectors(page);

  await expect(chainSelect).toBeVisible();
  await chainSelect.selectOption({ label: chainTheme.label });

  await kindSelect.selectOption('residue-type');
  const residueSelectors = await firstRepThemeSelectors(page);
  const residueSelect = residueSelectors.residueSelect;
  const residueRepId = residueSelectors.repId;
  await expect(residueSelect).toBeVisible({ timeout: 10000 });

  // Switching type back to residue should not keep chain theme and should
  // prefer the currently selected residue theme for the mode when available.
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, residueRepId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe(residueTheme.value);

  // Bug 2 check: explicit residue custom -> default should map to mode default provider.
  await residueSelect.selectOption({ label: residueTheme.label });
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, residueRepId);
    return state?.colorThemeName;
  }, { timeout: 10000 }).toBe(residueTheme.value);

  await residueSelect.selectOption({ label: 'Default' });
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, residueRepId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});

test('switching from custom chain theme to residue type applies default residue theme', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page, '4ug0-chain-colours-alan.csv');

  // Keep global theme mode on chain and set custom chain theme.
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  // Reproduce user flow on the default cartoon representation.
  const { chainSelect, kindSelect, repId } = await firstRepThemeSelectors(page);
  await expect(chainSelect).toBeVisible({ timeout: 10000 });
  await chainSelect.selectOption({ label: chainTheme.label });

  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe(chainTheme.value);

  await kindSelect.selectOption('residue-type');

  // Expected behavior: switching Theme Type to residue should apply the
  // mode-specific default residue theme immediately.
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');

  // Runtime effective theme should also reflect residue default, not stale chain theme.
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.effectiveColorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');

  // Visual guardrail: effective residue default palette should not be a pure chain
  // palette projection from the uploaded chain theme.
  const chainThemeRows = await page.evaluate(() => {
    const api = (window as any).__ribocodeTestApi;
    if (!api?.getLoadedThemeRowsByName) return [];
    return api.getLoadedThemeRowsByName('4ug0-chain-colours-alan') || [];
  });
  const chainThemeColors = new Set(
    (Array.isArray(chainThemeRows) ? chainThemeRows : [])
      .map((row: any) => String(row?.color ?? '').trim().toUpperCase())
      .filter(Boolean)
  );

  const defaultResidueSamples = await getDefaultResidueColorSamples(page, 'AlignedTo', 'A', 24);
  expect(defaultResidueSamples.length).toBeGreaterThan(0);
  const hasColorOutsideChainPalette = defaultResidueSamples.some((row: any) => {
    const color = String(row?.color ?? '').trim().toUpperCase();
    return color && !chainThemeColors.has(color);
  });
  expect(hasColorOutsideChainPalette).toBe(true);
});

test('switching Theme Type chain -> residue keeps the same representation id', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page, '4ug0-chain-colours-alan.csv');

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const selectorsBefore = await firstRepThemeSelectors(page);
  const initialRepId = selectorsBefore.repId;
  await selectorsBefore.chainSelect.selectOption({ label: chainTheme.label });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, initialRepId))?.colorThemeName, { timeout: 20000 }).toBe(chainTheme.value);

  await selectorsBefore.kindSelect.selectOption('residue-type');

  const selectorsAfter = await firstRepThemeSelectors(page);
  expect(selectorsAfter.repId).toBe(initialRepId);
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, initialRepId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});

test('after switching to residue type, selecting a newly loaded residue theme applies it to the same representation', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueThemeA = await uploadResidueTheme(page, 'residue-type-colours-example.csv');

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const selectors = await firstRepThemeSelectors(page);
  const repId = selectors.repId;
  await selectors.chainSelect.selectOption({ label: chainTheme.label });
  await selectors.kindSelect.selectOption('residue-type');

  const residueSelectA = page.locator(`#viewer-column-A-rep-residue-theme-${repId}`);
  await expect(residueSelectA).toBeVisible({ timeout: 10000 });
  await residueSelectA.selectOption({ value: residueThemeA.value });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe(residueThemeA.value);

  const residueThemeB = await uploadResidueTheme(page, '4ug0-residue-type-colours-amino-acids-only.csv');

  const residueSelectB = page.locator(`#viewer-column-A-rep-residue-theme-${repId}`);
  await expect(residueSelectB).toBeVisible({ timeout: 10000 });
  await residueSelectB.selectOption({ value: residueThemeB.value });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe(residueThemeB.value);
});

test('while already in residue type, loading and selecting a custom residue theme applies immediately', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const selectors = await firstRepThemeSelectors(page);
  const repId = selectors.repId;
  await selectors.kindSelect.selectOption('residue-type');

  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');

  const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');

  const residueSelect = page.locator(`#viewer-column-A-rep-residue-theme-${repId}`);
  await expect(residueSelect).toBeVisible({ timeout: 10000 });
  await residueSelect.selectOption({ value: residueTheme.value });

  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe(residueTheme.value);
  await expect.poll(async () => {
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.effectiveColorThemeName;
  }, { timeout: 20000 }).toBe(residueTheme.value);
});

test('manual flow visual check: switching Theme Type chain -> residue changes viewer colors', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);
  await assertWebGLAvailable(page);

  const chainTheme = await uploadChainTheme(page, '4ug0-chain-colours-alan.csv');

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const { chainSelect, kindSelect, repId } = await firstRepThemeSelectors(page);
  await expect(chainSelect).toBeVisible({ timeout: 10000 });
  await chainSelect.selectOption({ label: chainTheme.label });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe(chainTheme.value);

  const beforeHash = await captureViewerAVisualHash(page);

  await kindSelect.selectOption('residue-type');
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, repId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');

  const afterHash = await captureViewerAVisualHash(page);
  expect(afterHash).not.toBe(beforeHash);
});

test('manual flow visual check: switching Residue Theme custom -> default changes viewer colors', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);
  await assertWebGLAvailable(page);

  const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');

  const { kindSelect, repId } = await firstRepThemeSelectors(page);
  await kindSelect.selectOption('residue-type');
  const residueSelectors = await firstRepThemeSelectors(page);
  const residueSelect = residueSelectors.residueSelect;
  const residueRepId = residueSelectors.repId;
  await expect(residueSelect).toBeVisible({ timeout: 10000 });

  // Ensure representation is using the loaded custom residue theme first.
  await residueSelect.selectOption({ label: residueTheme.label });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, residueRepId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);

  await residueSelect.selectOption({ label: 'Default' });
  const afterDefaultSelectors = await firstRepThemeSelectors(page);
  const afterDefaultRepId = afterDefaultSelectors.repId || residueRepId;
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, afterDefaultRepId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, afterDefaultRepId))?.effectiveColorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});

test('visual hash matches between residue custom->default and direct residue-default workflows', async ({ browser }) => {
  test.setTimeout(240000);

  const fromCustomThenDefault = await runScenarioAndGetFinalRepState(browser, 'residue-custom-then-default');
  const fromDirectDefault = await runScenarioAndGetFinalRepState(browser, 'residue-default-direct');

  expect(fromCustomThenDefault.state?.colorThemeName).toBe('AlignedTo-default-residue-colors');
  expect(fromDirectDefault.state?.colorThemeName).toBe('AlignedTo-default-residue-colors');
  expect(fromCustomThenDefault.state?.effectiveColorThemeName).toBe('AlignedTo-default-residue-colors');
  expect(fromDirectDefault.state?.effectiveColorThemeName).toBe('AlignedTo-default-residue-colors');

  expect(fromCustomThenDefault.hash).toBe(fromDirectDefault.hash);
});

test('debug capture: residue-default workflows emit comparable viewer artifacts', async ({ browser }, testInfo) => {
  test.setTimeout(240000);

  const flow1 = await runScenarioAndCapture(browser, 'residue-custom-then-default');
  const flow2 = await runScenarioAndCapture(browser, 'residue-default-direct');

  const flow1Path = testInfo.outputPath('flow1-residue-custom-then-default.png');
  const flow2Path = testInfo.outputPath('flow2-residue-default-direct.png');
  fs.writeFileSync(flow1Path, flow1.png);
  fs.writeFileSync(flow2Path, flow2.png);

  await testInfo.attach('flow1-state.json', {
    body: Buffer.from(JSON.stringify(flow1.state ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow2-state.json', {
    body: Buffer.from(JSON.stringify(flow2.state ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow1-all-states.json', {
    body: Buffer.from(JSON.stringify(flow1.allStates ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow2-all-states.json', {
    body: Buffer.from(JSON.stringify(flow2.allStates ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow1-camera.json', {
    body: Buffer.from(JSON.stringify(flow1.cameraSnapshots ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow2-camera.json', {
    body: Buffer.from(JSON.stringify(flow2.cameraSnapshots ?? null, null, 2), 'utf8'),
    contentType: 'application/json',
  });
  await testInfo.attach('flow-hashes.txt', {
    body: Buffer.from(`flow1=${flow1.hash}\nflow2=${flow2.hash}\n`, 'utf8'),
    contentType: 'text/plain',
  });

  console.log(`[debug-capture] flow1 image: ${flow1Path}`);
  console.log(`[debug-capture] flow2 image: ${flow2Path}`);
  console.log(`[debug-capture] flow1 hash: ${flow1.hash}`);
  console.log(`[debug-capture] flow2 hash: ${flow2.hash}`);
  console.log(`[debug-capture] flow1 state: ${JSON.stringify(flow1.state ?? null)}`);
  console.log(`[debug-capture] flow2 state: ${JSON.stringify(flow2.state ?? null)}`);
  console.log(`[debug-capture] flow1 allStates: ${JSON.stringify(flow1.allStates ?? null)}`);
  console.log(`[debug-capture] flow2 allStates: ${JSON.stringify(flow2.allStates ?? null)}`);
  console.log(`[debug-capture] flow1 camera: ${JSON.stringify(flow1.cameraSnapshots ?? null)}`);
  console.log(`[debug-capture] flow2 camera: ${JSON.stringify(flow2.cameraSnapshots ?? null)}`);

  // Keep this check so failures immediately surface while still preserving artifacts.
  expect(flow1.hash).toBe(flow2.hash);
});

test('newly added representation switches chain -> residue and custom residue -> default correctly', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueTheme = await uploadResidueTheme(page);

  // Repro-critical step: add a new representation before switching per-representation themes.
  await addAlignedToRepresentation(page, 'spacefill');

  // Keep global mode on chain and chain theme selected, as in user workflow.
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const { chainSelect, kindSelect } = await latestRepThemeSelectors(page);

  await expect(chainSelect).toBeVisible();
  await chainSelect.selectOption({ label: chainTheme.label });

  await kindSelect.selectOption('residue-type');
  let latestResidueSelectors = await latestRepThemeSelectors(page);
  let residueSelect = latestResidueSelectors.residueSelect;
  let repId = latestResidueSelectors.repId;
  await expect(residueSelect).toBeVisible({ timeout: 10000 });

  // Newly added representation should switch away from chain theme and use the
  // mode-selected residue theme when switching Theme Type to residue.
  await expect.poll(async () => {
    latestResidueSelectors = await latestRepThemeSelectors(page);
    repId = latestResidueSelectors.repId;
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe(residueTheme.value);

  // Bug 2 check on the newly added representation.
  latestResidueSelectors = await latestRepThemeSelectors(page);
  residueSelect = latestResidueSelectors.residueSelect;
  repId = latestResidueSelectors.repId;
  await residueSelect.selectOption({ label: residueTheme.label });
  await expect.poll(async () => {
    latestResidueSelectors = await latestRepThemeSelectors(page);
    repId = latestResidueSelectors.repId;
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 10000 }).toBe(residueTheme.value);

  latestResidueSelectors = await latestRepThemeSelectors(page);
  residueSelect = latestResidueSelectors.residueSelect;
  repId = latestResidueSelectors.repId;
  await residueSelect.selectOption({ label: 'Default' });
  await expect.poll(async () => {
    latestResidueSelectors = await latestRepThemeSelectors(page);
    repId = latestResidueSelectors.repId;
    const state = await getAlignedToRepThemeStateWithFallback(page, repId);
    return state?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});

test('switching between two residue themes and back to default updates representation correctly', async ({ page }) => {
  test.setTimeout(180000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueThemeA = await uploadResidueTheme(page, 'residue-type-colours-example.csv');
  const residueThemeB = await uploadResidueTheme(page, '4ug0-residue-type-colours-amino-acids-only.csv');

  await addAlignedToRepresentation(page, 'spacefill');

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const { chainSelect, kindSelect } = await latestRepThemeSelectors(page);
  await chainSelect.selectOption({ label: chainTheme.label });
  await kindSelect.selectOption('residue-type');
  const latestResidueSelectors = await latestRepThemeSelectors(page);
  const residueSelect = latestResidueSelectors.residueSelect;
  const repId = latestResidueSelectors.repId;
  await expect(residueSelect).toBeVisible({ timeout: 10000 });

  await residueSelect.selectOption({ value: residueThemeA.value });
  let activeRepId = repId;
  await expect.poll(async () => {
    activeRepId = (await latestRepThemeSelectors(page)).repId;
    return (await getAlignedToRepThemeStateWithFallback(page, activeRepId))?.colorThemeName;
  }, { timeout: 20000 }).toBe(residueThemeA.value);

  const selectorsAfterA = await latestRepThemeSelectors(page);
  await selectorsAfterA.residueSelect.selectOption({ value: residueThemeB.value });
  await expect.poll(async () => {
    activeRepId = (await latestRepThemeSelectors(page)).repId;
    return (await getAlignedToRepThemeStateWithFallback(page, activeRepId))?.colorThemeName;
  }, { timeout: 20000 }).toBe(residueThemeB.value);

  const selectorsAfterB = await latestRepThemeSelectors(page);
  await selectorsAfterB.residueSelect.selectOption({ label: 'Default' });
  await expect.poll(async () => {
    activeRepId = (await latestRepThemeSelectors(page)).repId;
    return (await getAlignedToRepThemeStateWithFallback(page, activeRepId))?.colorThemeName;
  }, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});

test('sync-enabled flow mirrors representation residue theme switch across viewers', async ({ page }) => {
  test.setTimeout(240000);

  await loadAlignedToDataset(page);
  await loadAlignedDatasetInViewerB(page);
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible({ timeout: 60000 });
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueTheme = await uploadResidueTheme(page, 'residue-type-colours-example.csv');

  await ensureSyncEnabled(page);

  await addAlignedToRepresentation(page, 'spacefill');

  await openRepresentationControls(page);
  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const alignedToRepId = await getLatestRepIdForViewerMode(page, 'A', 'AlignedTo');
  expect(alignedToRepId).not.toBe('');

  const kindA = page.locator(`#viewer-column-A-rep-theme-kind-${alignedToRepId}`);
  await expect(kindA).toBeVisible({ timeout: 20000 });
  await kindA.selectOption('residue-type');

  let residueA = page.locator(`#viewer-column-A-rep-residue-theme-${alignedToRepId}`);
  await expect(residueA).toBeVisible({ timeout: 10000 });
  await residueA.selectOption({ value: residueTheme.value });

  await expect.poll(async () => (await getAlignedToRepThemeState(page, alignedToRepId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);
  await expect.poll(async () => (await getRepThemeStateByViewer(page, 'B'))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);

  residueA = page.locator(`#viewer-column-A-rep-residue-theme-${alignedToRepId}`);
  await expect(residueA).toBeVisible({ timeout: 10000 });
  await residueA.selectOption({ label: 'Default' });
  await expect.poll(async () => (await getAlignedToRepThemeState(page, alignedToRepId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
  await expect.poll(async () => (await getRepThemeStateByViewer(page, 'B'))?.colorThemeName, { timeout: 20000 }).toBe('Aligned-default-residue-colors');
});

test('session save/load restores representation residue custom and default switches', async ({ page }) => {
  test.setTimeout(300000);

  await loadAlignedToDataset(page);
  await openRepresentationControls(page);

  const chainTheme = await uploadChainTheme(page);
  const residueTheme = await uploadResidueTheme(page, '4ug0-residue-type-colours-amino-acids-only.csv');

  await addAlignedToRepresentation(page, 'spacefill');

  await page.selectOption('#viewer-column-A-alignedto-color-mode-select', 'chain');
  await page.selectOption('#viewer-column-A-alignedto-chain-colour-theme-select', { value: chainTheme.value });

  const alignedToRepId = await getLatestRepIdForViewerMode(page, 'A', 'AlignedTo');
  expect(alignedToRepId).not.toBe('');

  const kindSelect = page.locator(`#viewer-column-A-rep-theme-kind-${alignedToRepId}`);
  await expect(kindSelect).toBeVisible({ timeout: 20000 });
  await kindSelect.selectOption('residue-type');

  const residueSelect = page.locator(`#viewer-column-A-rep-residue-theme-${alignedToRepId}`);
  await expect(residueSelect).toBeVisible({ timeout: 10000 });
  await residueSelect.selectOption({ value: residueTheme.value });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, alignedToRepId))?.colorThemeName, { timeout: 20000 }).toBe(residueTheme.value);

  await residueSelect.selectOption({ label: 'Default' });
  await expect.poll(async () => (await getAlignedToRepThemeStateWithFallback(page, alignedToRepId))?.colorThemeName, { timeout: 20000 }).toBe('AlignedTo-default-residue-colors');
});
