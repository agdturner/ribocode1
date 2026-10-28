import { test, expect } from '@playwright/test';
import { loadSessionAndRequiredFiles } from './helpers/session-load';

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

type TestApiSnapshots = {
  viewerA?: Snapshot;
  viewerB?: Snapshot;
};

type TestApiRawSnapshot = {
  position?: any;
  target?: any;
  up?: any;
  radius?: number;
};

type TestApiRawSnapshots = {
  viewerA?: TestApiRawSnapshot;
  viewerB?: TestApiRawSnapshot;
};

function normalizeVec3(value: any): [number, number, number] | undefined {
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

function normalizeRawSnapshot(snapshot: TestApiRawSnapshot | undefined): Snapshot | undefined {
  if (!snapshot) return undefined;
  const position = normalizeVec3(snapshot.position);
  const target = normalizeVec3(snapshot.target);
  const up = normalizeVec3(snapshot.up);
  const radius = Number(snapshot.radius);
  if (!position || !target || !up || !Number.isFinite(radius)) return undefined;
  return { position, target, up, radius };
}

function chooseSnapshot(serialized: Snapshot | undefined, raw: TestApiRawSnapshot | undefined): Snapshot | undefined {
  if (serialized) return serialized;
  return normalizeRawSnapshot(raw);
}

function expectSnapshotClose(actual: Snapshot | undefined, expected: Snapshot, tol = 1e-6) {
  expect(actual).toBeDefined();
  if (!actual) return;

  for (let i = 0; i < 3; i += 1) {
    expect(actual.position[i]).toBeCloseTo(expected.position[i], 6);
    expect(actual.target[i]).toBeCloseTo(expected.target[i], 6);
    expect(actual.up[i]).toBeCloseTo(expected.up[i], 6);
  }
  expect(actual.radius).toBeCloseTo(expected.radius, 6);

  // Extra guard to catch accidental synchronization to the other viewer snapshot.
  expect(Math.abs(actual.radius - expected.radius)).toBeLessThanOrEqual(tol);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('session load keeps viewer B camera snapshot stable when sync is restored', async ({ page }) => {
  test.setTimeout(90000);

  const expectedA: Snapshot = {
    position: [30, 31, 32],
    target: [3, 4, 5],
    up: [0, 1, 0],
    radius: 55,
  };
  const expectedB: Snapshot = {
    position: [90, 91, 92],
    target: [9, 10, 11],
    up: [0, 1, 0],
    radius: 95,
  };

  await page.goto('http://localhost:5173/');
  await loadSessionAndRequiredFiles(page, 'test-session-sync-camera.json');

  await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
  await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();

  // Session load can still be finalizing while viewer containers are visible.
  // Wait for the sync control to become interactive before checking sync state.
  await expect(page.locator('#generalcontrols-sync-select')).toBeEnabled({ timeout: 60000 });
  await expect(page.locator('#generalcontrols-sync-select')).toHaveText('Sync: On', { timeout: 60000 });

  await expect.poll(async () => {
    const syncState = await page.evaluate(() => (window as any).__ribocodeTestApi?.getSyncState?.());
    return syncState?.syncEnabled === true;
  }, { timeout: 30000 }).toBe(true);

  const syncState = await page.evaluate(() => (window as any).__ribocodeTestApi?.getSyncState?.());
  expect(syncState?.syncEnabled).toBe(true);

  const snapshotsAfterLoad = await page.evaluate(() => {
    const api = (window as any).__ribocodeTestApi;
    return {
      serialized: api?.getCameraSnapshots?.() as TestApiSnapshots,
      raw: api?.getRawCameraSnapshots?.() as TestApiRawSnapshots,
    };
  });

  const cameraAfterLoadA = chooseSnapshot(snapshotsAfterLoad?.serialized?.viewerA, snapshotsAfterLoad?.raw?.viewerA);
  const cameraAfterLoadB = chooseSnapshot(snapshotsAfterLoad?.serialized?.viewerB, snapshotsAfterLoad?.raw?.viewerB);

  if (cameraAfterLoadA && cameraAfterLoadB) {
    expectSnapshotClose(cameraAfterLoadA, expectedA);
    expectSnapshotClose(cameraAfterLoadB, expectedB);

    // Allow requestAnimationFrame-based sync polling to run if it was going to overwrite snapshots.
    await page.waitForTimeout(300);

    const snapshotsAfterSettle = await page.evaluate(() => {
      const api = (window as any).__ribocodeTestApi;
      return {
        serialized: api?.getCameraSnapshots?.() as TestApiSnapshots,
        raw: api?.getRawCameraSnapshots?.() as TestApiRawSnapshots,
      };
    });

    expectSnapshotClose(
      chooseSnapshot(snapshotsAfterSettle?.serialized?.viewerA, snapshotsAfterSettle?.raw?.viewerA),
      expectedA
    );
    expectSnapshotClose(
      chooseSnapshot(snapshotsAfterSettle?.serialized?.viewerB, snapshotsAfterSettle?.raw?.viewerB),
      expectedB
    );
    return;
  }

  // Fallback for CI/headless environments where camera snapshots are unavailable.
  await page.click('#viewer-column-A-clipping-controls-toggle-btn');
  await page.click('#viewer-column-B-clipping-controls-toggle-btn');

  const alignedToNear = page.locator('#viewer-column-A-alignedto-clip-near-number');
  const alignedToFar = page.locator('#viewer-column-A-alignedto-clip-far-number');
  const alignedNear = page.locator('#viewer-column-B-aligned-clip-near-number');
  const alignedFar = page.locator('#viewer-column-B-aligned-clip-far-number');

  await expect(alignedToNear).toHaveValue('0.74');
  await expect(alignedToFar).toHaveValue('62');
  await expect(alignedNear).toHaveValue('0.89');
  await expect(alignedFar).toHaveValue('77');

  await page.waitForTimeout(300);

  await expect(alignedToNear).toHaveValue('0.74');
  await expect(alignedToFar).toHaveValue('62');
  await expect(alignedNear).toHaveValue('0.89');
  await expect(alignedFar).toHaveValue('77');
});
