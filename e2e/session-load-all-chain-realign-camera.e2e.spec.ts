import { test, expect, type Page } from '@playwright/test';
import { dataPath, waitForSessionMenuReady } from './helpers/session-load';

test.use({
  launchOptions: {
    args: [
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  },
});

type Snapshot = {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  radius: number;
};

function toVec3(value: any): [number, number, number] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value) && value.length >= 3) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  if (typeof value === 'object') {
    const x = Number((value as any).x ?? (value as any)[0]);
    const y = Number((value as any).y ?? (value as any)[1]);
    const z = Number((value as any).z ?? (value as any)[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) return [x, y, z];
  }
  return undefined;
}

function normalizeSnapshot(value: any): Snapshot | undefined {
  if (!value) return undefined;
  const position = toVec3(value.position);
  const target = toVec3(value.target);
  const up = toVec3(value.up);
  const radius = Number(value.radius);
  if (!position || !target || !up || !Number.isFinite(radius)) return undefined;
  return { position, target, up, radius };
}

function expectSnapshotsClose(actual: Snapshot, expected: Snapshot, decimals = 4) {
  for (let i = 0; i < 3; i += 1) {
    expect(actual.position[i]).toBeCloseTo(expected.position[i], decimals);
    expect(actual.target[i]).toBeCloseTo(expected.target[i], decimals);
    expect(actual.up[i]).toBeCloseTo(expected.up[i], decimals);
  }
  expect(actual.radius).toBeCloseTo(expected.radius, decimals);
}

async function loadAlignedToAndAligned(page: Page) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('6XU6.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 45000 });

  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });
}

async function openChainControls(page: Page) {
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');
  await expect(page.locator('#viewer-column-A-chain-table-container')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#viewer-column-B-chain-table-container')).toBeVisible({ timeout: 30000 });
}

async function readViewerBCameraSnapshot(page: Page): Promise<Snapshot | undefined> {
  const cameraData = await page.evaluate(() => {
    const api = (window as any).__ribocodeTestApi;
    return {
      serialized: api?.getCameraSnapshots?.()?.viewerB,
      raw: api?.getRawCameraSnapshots?.()?.viewerB,
    };
  });

  return normalizeSnapshot(cameraData?.serialized) ?? normalizeSnapshot(cameraData?.raw);
}

async function ensureViewerBClippingPanelOpen(page: Page) {
  const clipNear = page.locator('#viewer-column-B-aligned-clip-near-number');
  if (await clipNear.isVisible()) return;
  await page.click('#viewer-column-B-clipping-controls-toggle-btn');
  if (await clipNear.isVisible()) return;
  await page.click('#viewer-column-B-clipping-controls-toggle-btn');
  await expect(clipNear).toBeVisible({ timeout: 10000 });
}

async function readViewerBClippingValues(page: Page): Promise<{ near: string; far: string }> {
  await ensureViewerBClippingPanelOpen(page);
  const clipNear = page.locator('#viewer-column-B-aligned-clip-near-number');
  const clipFar = page.locator('#viewer-column-B-aligned-clip-far-number');
  await expect(clipFar).toBeVisible({ timeout: 10000 });
  return {
    near: await clipNear.inputValue(),
    far: await clipFar.inputValue(),
  };
}

async function saveAllAndDownloadSession(page: Page): Promise<string> {
  await waitForSessionMenuReady(page);
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('Load All keeps viewer B camera stable after Align Chains + Save All round-trip', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:5173/');
  await loadAlignedToAndAligned(page);
  await openChainControls(page);

  await page.click('[data-testid="viewer-column-A-chain-table-row-CU"]');
  await page.click('[data-testid="viewer-column-B-chain-table-row-CU"]');

  await expect(page.locator('#viewer-column-B-aligned-highlight-chain-btn')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewer-column-B-aligned-highlight-chain-btn');
  await expect(page.locator('#viewer-column-B-aligned-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'true');

  const realignButton = page.locator('#generalcontrols-realign-btn');
  await expect(realignButton).toBeEnabled({ timeout: 20000 });
  await realignButton.click();
  await expect(realignButton).toBeEnabled({ timeout: 20000 });

  await expect(page.locator('#viewer-column-B-aligned-zoom-chain-btn')).toBeEnabled({ timeout: 10000 });
  await page.click('#viewer-column-B-aligned-zoom-chain-btn');
  await page.waitForTimeout(250);

  const beforeSave = await readViewerBCameraSnapshot(page);
  const clippingBeforeSave = await readViewerBClippingValues(page);

  const sessionFilePath = await saveAllAndDownloadSession(page);

  // Move the camera away so Load All must restore the saved camera.
  await page.locator('#viewer-column-B').getByRole('button', { name: 'Reset Zoom' }).click();
  await page.waitForTimeout(250);

  await loadAllFromSessionFile(page, sessionFilePath);
  await page.waitForTimeout(350);

  const afterLoad = await readViewerBCameraSnapshot(page);
  if (beforeSave && afterLoad) {
    expectSnapshotsClose(afterLoad, beforeSave);
    return;
  }

  // Fallback for environments where camera snapshots are unavailable.
  const clippingAfterLoad = await readViewerBClippingValues(page);
  expect(clippingAfterLoad.near).toBe(clippingBeforeSave.near);
  expect(clippingAfterLoad.far).toBe(clippingBeforeSave.far);
});
