/**
 * Playwright E2E tests for residue-based realignment workflows.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test, expect, type Page } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

type ChainRealignMetrics = {
  timestamp: number;
  alignedToChainId: string;
  alignedChainId: string;
  atomPairCount: number;
  rmsd: number;
  meanPairDistanceBefore: number;
  meanPairDistanceAfter: number;
  improvementRatio: number;
};

type ResidueRealignMetrics = {
  timestamp: number;
  alignedToChainId: string;
  alignedChainId: string;
  alignedToResidueIds: string[];
  alignedResidueIds: string[];
  atomPairCount: number;
  rmsd: number;
  meanPairDistanceBefore: number;
  meanPairDistanceAfter: number;
  improvementRatio: number;
};

type ResidueRealignDebugStatus = {
  phase: 'idle' | 'blocked' | 'running' | 'success' | 'failed';
  reason?: string;
  details?: Record<string, unknown>;
  timestamp: number;
};

type Snapshot = {
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  radius: number;
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

function normalizeSnapshot(value: any): Snapshot | undefined {
  if (!value) return undefined;
  const position = normalizeVec3(value.position);
  const target = normalizeVec3(value.target);
  const up = normalizeVec3(value.up);
  const radius = Number(value.radius);
  if (!position || !target || !up || !Number.isFinite(radius)) return undefined;
  return { position, target, up, radius };
}

async function readCameraSnapshots(page: Page): Promise<{ viewerA?: Snapshot; viewerB?: Snapshot }> {
  const data = await page.evaluate(() => {
    const api = (window as any).__ribocodeTestApi;
    return {
      serialized: api?.getCameraSnapshots?.(),
      raw: api?.getRawCameraSnapshots?.(),
    };
  });

  return {
    viewerA: normalizeSnapshot(data?.serialized?.viewerA) ?? normalizeSnapshot(data?.raw?.viewerA),
    viewerB: normalizeSnapshot(data?.serialized?.viewerB) ?? normalizeSnapshot(data?.raw?.viewerB),
  };
}

function maxSnapshotDelta(a: Snapshot, b: Snapshot): number {
  const values = [
    ...a.position.map((v, i) => Math.abs(v - b.position[i])),
    ...a.target.map((v, i) => Math.abs(v - b.target[i])),
    ...a.up.map((v, i) => Math.abs(v - b.up[i])),
    Math.abs(a.radius - b.radius),
  ];
  return Math.max(...values);
}

async function loadDatasets(page: Page, alignedTo: string, aligned: string) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath(alignedTo));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toBeVisible({ timeout: 60000 });

  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath(aligned));
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });
}

async function openChainControls(page: Page) {
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');
}

async function openResidueControls(page: Page) {
  await expect(page.locator('#viewer-column-A-alignedto-residue-controls-toggle-btn')).toBeEnabled({ timeout: 30000 });
  await expect(page.locator('#viewer-column-B-aligned-residue-controls-toggle-btn')).toBeEnabled({ timeout: 30000 });
  await page.click('#viewer-column-A-alignedto-residue-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-residue-controls-toggle-btn');
}

async function clickChainRow(page: Page, viewer: 'A' | 'B', chainId: string) {
  const prefix = `viewer-column-${viewer}-chain-table-row-`;
  const target = chainId.toUpperCase();

  const testId = await page.waitForFunction(
    ({ rowPrefix, rowTarget }) => {
      const rows = Array.from(document.querySelectorAll(`[data-testid^="${rowPrefix}"]`));
      const match = rows.find((row) => {
        const tid = row.getAttribute('data-testid') || '';
        const value = tid.replace(rowPrefix, '').trim().toUpperCase();
        return value === rowTarget;
      });
      return match?.getAttribute('data-testid') || null;
    },
    { rowPrefix: prefix, rowTarget: target },
    { timeout: 30000 }
  );

  const resolvedTestId = await testId.jsonValue() as string;
  expect(resolvedTestId).toBeTruthy();
  await page.click(`[data-testid="${resolvedTestId}"]`);
}

async function getAllResidueValues(page: Page, selector: string): Promise<string[]> {
  return await page.evaluate((sel) => {
    const select = document.querySelector(sel) as HTMLSelectElement | null;
    if (!select) return [];
    return Array.from(select.options)
      .map((option) => option.value)
      .filter((value) => value && value.length > 0);
  }, selector);
}

async function getSharedResidueValues(
  page: Page,
  alignedToSelector: string,
  alignedSelector: string
): Promise<string[]> {
  const [alignedToValues, alignedValues] = await Promise.all([
    getAllResidueValues(page, alignedToSelector),
    getAllResidueValues(page, alignedSelector),
  ]);
  const alignedSet = new Set(alignedValues);
  return alignedToValues.filter((value) => alignedSet.has(value));
}

async function getResidueValuesByAuthRange(page: Page, selector: string, start: number, end: number): Promise<string[]> {
  return await page.evaluate(
    ({ sel, startAuth, endAuth }) => {
      const select = document.querySelector(sel) as HTMLSelectElement | null;
      if (!select) return [];
      const out: string[] = [];
      for (const option of Array.from(select.options)) {
        const label = option.textContent || '';
        const match = label.match(/\[auth\s+(-?\d+)\]/i);
        if (!match) continue;
        const authNum = Number(match[1]);
        if (Number.isFinite(authNum) && authNum >= startAuth && authNum <= endAuth) {
          out.push(option.value);
        }
      }
      return out;
    },
    { sel: selector, startAuth: start, endAuth: end }
  );
}

async function waitForResidueMetricsOrThrow(
  page: Page,
  validate: (metrics: ResidueRealignMetrics) => boolean,
  timeout = 30000
): Promise<ResidueRealignMetrics> {
  const outcome = await page.waitForFunction(
    ({ timeoutMs }) => {
      const start = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          const api = (window as any).__ribocodeTestApi;
          const metrics = api?.getLastRealignMetrics?.()?.residue;
          const debug = api?.getLastResidueRealignDebug?.();
          if (metrics) {
            resolve({ ok: true, metrics, debug });
            return;
          }
          if (debug?.phase === 'failed' || debug?.phase === 'blocked') {
            resolve({ ok: false, debug });
            return;
          }
          if (Date.now() - start > timeoutMs) {
            resolve({ ok: false, debug: debug ?? null, timeout: true });
            return;
          }
          setTimeout(check, 100);
        };
        check();
      });
    },
    { timeoutMs: timeout },
    { timeout: timeout + 5000 }
  );

  const result = await outcome.jsonValue() as {
    ok: boolean;
    metrics?: ResidueRealignMetrics;
    debug?: ResidueRealignDebugStatus | null;
    timeout?: boolean;
  };

  if (!result.ok || !result.metrics) {
    throw new Error(`Residue realign did not produce metrics. Debug: ${JSON.stringify(result.debug ?? null)}`);
  }

  if (!validate(result.metrics)) {
    throw new Error(`Residue metrics were produced but did not match expected scenario: ${JSON.stringify(result.metrics)}`);
  }

  return result.metrics;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('Residue realign on all residues in chain CU is consistent with chain realign', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:5173/');
  await loadDatasets(page, '6XU6.cif', '6xu8.cif');
  await openChainControls(page);

  await clickChainRow(page, 'A', 'CU');
  await clickChainRow(page, 'B', 'CU');
  await openResidueControls(page);

  const chainRealignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(chainRealignBtn).toBeEnabled();
  await expect(chainRealignBtn).toHaveText(/Align Chains:\s*CU\s*->\s*CU|Align Chains:\s*CU\s*→\s*CU/);
  await chainRealignBtn.click();

  const chainMetricsHandle = await page.waitForFunction(() => {
    const metrics = (window as any).__ribocodeTestApi?.getLastRealignMetrics?.()?.chain;
    if (!metrics) return null;
    if (metrics.alignedToChainId !== 'CU' || metrics.alignedChainId !== 'CU') return null;
    if (!Number.isFinite(metrics.rmsd) || !Number.isFinite(metrics.improvementRatio)) return null;
    return metrics;
  }, { timeout: 30000 });
  const chainMetrics = await chainMetricsHandle.jsonValue() as ChainRealignMetrics;

  const alignedToResidueValues = await getAllResidueValues(page, '#viewer-column-A-alignedto-residue-select');
  const alignedResidueValues = await getAllResidueValues(page, '#viewer-column-B-aligned-residue-select');
  expect(alignedToResidueValues.length).toBeGreaterThan(0);
  expect(alignedResidueValues.length).toBeGreaterThan(0);

  await page.selectOption('#viewer-column-A-alignedto-residue-select', alignedToResidueValues);
  await page.selectOption('#viewer-column-B-aligned-residue-select', alignedResidueValues);

  const residueRealignBtn = page.locator('#generalcontrols-realign-residue-btn');
  await expect(residueRealignBtn).toBeEnabled();
  await expect(residueRealignBtn).toHaveText(/Align Residues:\s*\d+\s*to\s*\d+/);
  await residueRealignBtn.click();

  const residueMetrics = await waitForResidueMetricsOrThrow(
    page,
    (metrics) => metrics.alignedToChainId === 'CU'
      && metrics.alignedChainId === 'CU'
      && Number.isFinite(metrics.rmsd)
      && Number.isFinite(metrics.improvementRatio)
  );

  expect(residueMetrics.atomPairCount).toBeGreaterThan(0);
  expect(residueMetrics.meanPairDistanceAfter).toBeLessThan(residueMetrics.meanPairDistanceBefore);
  expect(residueMetrics.improvementRatio).toBeGreaterThan(1);

  // Residue fit should generally use at least as many selected atoms as chain fit in this full-chain case.
  expect(residueMetrics.atomPairCount).toBeGreaterThanOrEqual(chainMetrics.atomPairCount);
});

test('Align Residues on 7WTT chain w and AF-Q13895 chain A for auth 23..30', async ({ page }) => {
  test.setTimeout(150000);

  await page.goto('http://localhost:5173/');
  await loadDatasets(page, '7WTT.cif', 'AF-Q13895-F1-model_v6.cif');
  await openChainControls(page);

  await clickChainRow(page, 'A', 'w');
  await clickChainRow(page, 'B', 'A');
  await openResidueControls(page);

  const alignedToResidues = await getResidueValuesByAuthRange(page, '#viewer-column-A-alignedto-residue-select', 23, 30);
  const alignedResidues = await getResidueValuesByAuthRange(page, '#viewer-column-B-aligned-residue-select', 23, 30);

  expect(alignedToResidues.length).toBe(8);
  expect(alignedResidues.length).toBe(8);

  await page.selectOption('#viewer-column-A-alignedto-residue-select', alignedToResidues);
  await page.selectOption('#viewer-column-B-aligned-residue-select', alignedResidues);

  const residueRealignBtn = page.locator('#generalcontrols-realign-residue-btn');
  await expect(residueRealignBtn).toBeEnabled();
  await expect(residueRealignBtn).toHaveText(/Align Residues:\s*8\s*to\s*8/);
  await residueRealignBtn.click();

  const residueMetrics = await waitForResidueMetricsOrThrow(
    page,
    (metrics) => String(metrics.alignedToChainId).toUpperCase() === 'W'
      && String(metrics.alignedChainId).toUpperCase() === 'A'
      && Number.isFinite(metrics.rmsd)
      && Number.isFinite(metrics.improvementRatio)
  );
  expect(residueMetrics.alignedToResidueIds.length).toBe(8);
  expect(residueMetrics.alignedResidueIds.length).toBe(8);
  expect(residueMetrics.atomPairCount).toBeGreaterThan(0);
  expect(residueMetrics.meanPairDistanceAfter).toBeLessThan(residueMetrics.meanPairDistanceBefore);
  expect(residueMetrics.improvementRatio).toBeGreaterThan(1);
});

test('residue realign restores A/B camera parity after prior chain realign', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:5173/');
  await loadDatasets(page, '6XU6.cif', '6xu8.cif');
  await openChainControls(page);

  await clickChainRow(page, 'A', 'CU');
  await clickChainRow(page, 'B', 'CU');
  await openResidueControls(page);

  const chainRealignBtn = page.locator('#generalcontrols-realign-btn');
  await expect(chainRealignBtn).toBeEnabled();
  await chainRealignBtn.click();
  await expect(chainRealignBtn).toBeEnabled({ timeout: 20000 });

  // Intentionally diverge viewer B camera from viewer A.
  await page.locator('#viewer-column-B').getByRole('button', { name: 'Reset Zoom' }).click();
  await page.waitForTimeout(300);

  const sharedResidues = await getSharedResidueValues(
    page,
    '#viewer-column-A-alignedto-residue-select',
    '#viewer-column-B-aligned-residue-select'
  );
  expect(sharedResidues.length).toBeGreaterThan(0);

  const selectedResidue = sharedResidues[0];
  await page.selectOption('#viewer-column-A-alignedto-residue-select', [selectedResidue]);
  await page.selectOption('#viewer-column-B-aligned-residue-select', [selectedResidue]);

  const residueRealignBtn = page.locator('#generalcontrols-realign-residue-btn');
  await expect(residueRealignBtn).toBeEnabled();
  await residueRealignBtn.click();

  await waitForResidueMetricsOrThrow(
    page,
    (metrics) => metrics.alignedToChainId === 'CU'
      && metrics.alignedChainId === 'CU'
      && Number.isFinite(metrics.rmsd)
      && Number.isFinite(metrics.improvementRatio)
  );

  await page.waitForTimeout(300);
  const snapshots = await readCameraSnapshots(page);
  if (snapshots.viewerA && snapshots.viewerB) {
    expect(maxSnapshotDelta(snapshots.viewerA, snapshots.viewerB)).toBeLessThan(1e-4);
  }
});
