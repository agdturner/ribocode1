/**
 * Playwright E2E test to ensure initial load uses stable aligned transform baseline after hard cache flush.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-23
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { nativeClippingLaunchOptions } from './helpers/native-clipping';

type Coordinates = {
  xs: number[];
  ys: number[];
  zs: number[];
  atomIds: number[];
  units: Array<{ id: number; atomCount: number }>;
  phosphorusCount: number;
  anchors: {
    symbolTypes: string[];
    residueKeys: string[];
    xs: number[];
    ys: number[];
    zs: number[];
  };
};

type Camera = { position: number[]; target: number[]; up: number[] };

test.use({ launchOptions: nativeClippingLaunchOptions });
test.describe.configure({ timeout: 180000 });

for (const experimental of [false, true]) {
test(`initial load separates coordinate alignment from camera orientation for 6XU6/6XU8 (${experimental ? 'experimental' : 'default'})`, async ({ page }, testInfo) => {
  page.on('pageerror', error => console.error('[Initial alignment page error]', error.message));
  page.on('console', message => {
    if (message.type() === 'error') console.error('[Initial alignment browser error]', message.text());
  });
  await page.addInitScript(() => {
    (window as Window & { __RIBOCODE_E2E__?: boolean }).__RIBOCODE_E2E__ = true;
  });
  await page.goto(experimental ? '/?experimentalInitialAlignment=1' : '/');
  await page.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6XU6.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 90000 });
  await page.locator('#viewer-column-B-aligned-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6xu8.cif'));
  await expect(page.locator('#viewer-column-B').getByRole('button', { name: 'Hide 6XU8', exact: true }))
    .toBeVisible({ timeout: 90000 });

  const diagnostics = await page.evaluate(() => {
    const api = (window as Window & {
      __ribocodeTestApi?: {
        getInitialAlignmentCoordinates: (viewer: 'A' | 'B', mode: 'AlignedTo' | 'Aligned', chain: string) => Coordinates;
        getRawCameraSnapshots: () => { viewerA?: Camera; viewerB?: Camera };
        getLastRealignMetrics: () => { chain: unknown; residue: unknown };
        getExperimentalInitialAlignment: () => { status: string; pairCount?: number } | null;
      };
    }).__ribocodeTestApi;
    if (!api) throw new Error('Ribocode test API is unavailable.');
    const toA = api.getInitialAlignmentCoordinates('A', 'AlignedTo', 'CU');
    const toB = api.getInitialAlignmentCoordinates('B', 'AlignedTo', 'CU');
    const alignedA = api.getInitialAlignmentCoordinates('A', 'Aligned', 'CU');
    const alignedB = api.getInitialAlignmentCoordinates('B', 'Aligned', 'CU');

    const parity = (a: Coordinates, b: Coordinates) => {
      const orderingMatches = JSON.stringify(a.units) === JSON.stringify(b.units)
        && a.atomIds.length === b.atomIds.length
        && a.atomIds.every((id, i) => id === b.atomIds[i]);
      if (!orderingMatches) throw new Error('Viewer atom ordering differs; cannot compare coordinates by index.');
      let sumSq = 0;
      let maxDistance = 0;
      for (let i = 0; i < a.xs.length; i++) {
        const distanceSq = (a.xs[i] - b.xs[i]) ** 2
          + (a.ys[i] - b.ys[i]) ** 2 + (a.zs[i] - b.zs[i]) ** 2;
        sumSq += distanceSq;
        maxDistance = Math.max(maxDistance, Math.sqrt(distanceSq));
      }

      return { atomCount: a.xs.length, rmsd: Math.sqrt(sumSq / a.xs.length), maxDistance };
    };
    const centroid = (data: Coordinates) => [
      data.xs.reduce((sum, x) => sum + x, 0) / data.xs.length,
      data.ys.reduce((sum, y) => sum + y, 0) / data.ys.length,
      data.zs.reduce((sum, z) => sum + z, 0) / data.zs.length,
    ];

    // Shared author residue IDs are diagnostic anchors for this known CU pair, not the initial fit's correspondence.
    const reference = new Map(toA.anchors.residueKeys
      .map((key, i) => [`${toA.anchors.symbolTypes[i]}:${key}`, i] as const));
    let pairCount = 0;
    let sumSq = 0;
    alignedA.anchors.residueKeys.forEach((key, i) => {
      if (alignedA.anchors.symbolTypes[i] !== 'CA') return;
      const j = reference.get(`CA:${key}`);
      if (j === undefined) return;
      pairCount++;
      sumSq += (alignedA.anchors.xs[i] - toA.anchors.xs[j]) ** 2
        + (alignedA.anchors.ys[i] - toA.anchors.ys[j]) ** 2
        + (alignedA.anchors.zs[i] - toA.anchors.zs[j]) ** 2;
    });

    const cameras = api.getRawCameraSnapshots();
    if (!cameras.viewerA || !cameras.viewerB) throw new Error('Both camera snapshots are required.');
    const normalize = (v: number[]) => {
      const length = Math.hypot(...v);
      if (!Number.isFinite(length) || length === 0) throw new Error('Invalid camera direction.');
      return v.map(value => value / length);
    };
    const forward = (camera: Camera) => normalize(camera.target.map((value, i) => value - camera.position[i]));
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
    return {
      alignedToParity: parity(toA, toB),
      alignedParity: parity(alignedA, alignedB),
      centroids: { alignedTo: centroid(toA), aligned: centroid(alignedA) },
      phosphorusCounts: { alignedTo: toA.phosphorusCount, aligned: alignedA.phosphorusCount },
      initialCuFit: { pairCount, rmsd: Math.sqrt(sumSq / pairCount) },
      cameraOrientation: {
        forwardDot: dot(forward(cameras.viewerA), forward(cameras.viewerB)),
        upDot: dot(normalize(cameras.viewerA.up), normalize(cameras.viewerB.up)),
      },
      realignMetrics: api.getLastRealignMetrics(),
      experiment: api.getExperimentalInitialAlignment(),
    };
  });

  console.log('[Initial Alignment Diagnostic][6XU6->6XU8]', diagnostics);
  await testInfo.attach('initial-alignment-diagnostic', {
    body: JSON.stringify(diagnostics, null, 2),
    contentType: 'application/json',
  });
  for (const parity of [diagnostics.alignedToParity, diagnostics.alignedParity]) {
    expect(parity.atomCount).toBeGreaterThan(100000);
    expect(parity.maxDistance).toBeLessThan(1e-6);
    expect(parity.rmsd).toBeLessThan(1e-6);
  }
  expect(diagnostics.initialCuFit.pairCount).toBeGreaterThan(90);
  expect(Number.isFinite(diagnostics.initialCuFit.rmsd)).toBe(true);
  expect(diagnostics.phosphorusCounts.alignedTo).toBeGreaterThan(0);
  expect(diagnostics.phosphorusCounts.aligned).toBeGreaterThan(0);
  expect(diagnostics.realignMetrics.chain).toBeNull();
  expect(diagnostics.realignMetrics.residue).toBeNull();
  if (experimental) {
    expect(diagnostics.experiment?.status).toBe('fitted');
    expect(diagnostics.experiment?.pairCount).toBe(5912);
    // This is the original author-number proxy; sequence-supported quality is checked offline.
    expect(diagnostics.initialCuFit.rmsd).toBeLessThan(7);
    await page.locator('#viewer-column-A-select-zoom-controls-toggle-btn').click();
    await page.locator('#viewer-column-B-select-zoom-controls-toggle-btn').click();
    await page.locator('#viewer-column-A-alignedto-chain-controls-toggle-btn').click();
    await page.locator('#viewer-column-B-aligned-chain-controls-toggle-btn').click();
    await page.locator('#viewer-column-A-alignedto-select-chain-controls-toggle-btn').click();
    await page.locator('#viewer-column-B-aligned-select-chain-controls-toggle-btn').click();
    await page.locator('[data-testid="viewer-column-A-chain-table-row-CU"]').click();
    await page.locator('[data-testid="viewer-column-B-chain-table-row-CU"]').click();
    await page.locator('#generalcontrols-realign-btn').click();
    await expect.poll(() => page.evaluate(() => {
      const api = (window as Window & {
        __ribocodeTestApi?: { getLastRealignMetrics: () => { chain?: { rmsd: number } } };
      }).__ribocodeTestApi;
      return api?.getLastRealignMetrics().chain?.rmsd;
    }), { timeout: 30000 }).toBeLessThan(7);
  } else {
    expect(diagnostics.experiment).toBeNull();
    expect(diagnostics.initialCuFit.rmsd).toBeCloseTo(107.96288572683902, 3);
  }
});
}

test('experimental loading warns and leaves protein-only structures centered but unfitted', async ({ page }) => {
  const warnings: string[] = [];
  page.on('dialog', async dialog => {
    warnings.push(dialog.message());
    await dialog.accept();
  });
  await page.goto('/?experimentalInitialAlignment=1');
  const file = path.resolve(__dirname, '../data/input/AF-Q13895-F1-model_v6.cif');
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles(file);
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 90000 });
  await page.locator('#viewer-column-B-aligned-file-input').setInputFiles(file);
  await expect.poll(() => warnings.join('\n'), { timeout: 90000 }).toContain('centered but unfitted');
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toContainText('AF-Q13895', { timeout: 90000 });
  await expect(page.locator('#viewer-column-B').getByRole('button', { name: /Hide AF-Q13895/ }))
    .toBeVisible({ timeout: 90000 });
  const result = await page.evaluate(() => {
    const api = (window as Window & {
      __ribocodeTestApi?: {
        getExperimentalInitialAlignment: () => { status: string; reason?: string };
        getInitialAlignmentCoordinates: (viewer: 'A' | 'B', mode: 'Aligned', chain: string) => Coordinates;
      };
    }).__ribocodeTestApi;
    if (!api) throw new Error('Ribocode diagnostic API unavailable.');
    const a = api.getInitialAlignmentCoordinates('A', 'Aligned', 'A');
    const b = api.getInitialAlignmentCoordinates('B', 'Aligned', 'A');
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      experiment: api.getExperimentalInitialAlignment(),
      centroidA: [mean(a.xs), mean(a.ys), mean(a.zs)],
      centroidB: [mean(b.xs), mean(b.ys), mean(b.zs)],
    };
  });
  expect(result.experiment.status).toBe('unfitted');
  expect(result.experiment.reason).toContain('RNA polymer');
  for (const value of [...result.centroidA, ...result.centroidB]) expect(Math.abs(value)).toBeLessThan(1e-6);
});
