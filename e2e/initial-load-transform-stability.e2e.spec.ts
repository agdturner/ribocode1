/**
 * Playwright E2E test to ensure initial load uses stable aligned transform baseline after hard cache flush.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
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

async function hardResetBrowserState(page: Page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}

    try {
      const dbs = await (indexedDB as any).databases?.();
      if (Array.isArray(dbs)) {
        await Promise.all(
          dbs
            .map((db: any) => db?.name)
            .filter((name: string | undefined) => !!name)
            .map((name: string) => new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            }))
        );
      }
    } catch {}

    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      if (Array.isArray(regs)) {
        await Promise.all(regs.map(reg => reg.unregister()));
      }
    } catch {}

    try {
      const keys = await caches?.keys?.();
      if (Array.isArray(keys)) {
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {}
  });
}

async function loadPair(page: Page, alignedTo: string, aligned: string) {
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath(alignedTo));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toContainText(new RegExp(alignedTo.replace('.', '\\.'), 'i'), { timeout: 45000 });

  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath(aligned));
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toContainText(new RegExp(aligned.replace('.', '\\.'), 'i'), { timeout: 45000 });
}

async function captureAlignedTransformCheckpoint(page: Page, label: string) {
  const result = await page.evaluate((checkpointLabel) => {
    const api = (window as any).__ribocodeTestApi;
    api?.clearInternalAlignmentCaches?.();
    const snapshot = api?.captureStructureTransformCheckpoint?.(checkpointLabel);
    return snapshot ?? null;
  }, label);
  expect(result).toBeTruthy();
  return result as any;
}

function flattenTransform(transform: any): number[] {
  if (!transform || !Array.isArray(transform)) return [];
  return transform.map((v) => Number(v));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__RIBOCODE_E2E__ = true;
  });
});

test('initial load uses stable aligned transform baseline after hard cache flush', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('/');
  await hardResetBrowserState(page);
  await page.reload();

  await loadPair(page, '6XU6.cif', '6xu8.cif');

  const first = await captureAlignedTransformCheckpoint(page, 'initial-load-first');
  const firstA = flattenTransform(first?.viewerA?.transforms?.aligned);
  const firstB = flattenTransform(first?.viewerB?.transforms?.aligned);

  // Fresh load without realign should be identity (or absent/empty if Mol* has not materialized a transform node).
  if (firstA.length > 0) {
    expect(firstA).toHaveLength(16);
    expect(firstA[0]).toBeCloseTo(1, 5);
    expect(firstA[5]).toBeCloseTo(1, 5);
    expect(firstA[10]).toBeCloseTo(1, 5);
    expect(firstA[15]).toBeCloseTo(1, 5);
  }
  if (firstB.length > 0) {
    expect(firstB).toHaveLength(16);
    expect(firstB[0]).toBeCloseTo(1, 5);
    expect(firstB[5]).toBeCloseTo(1, 5);
    expect(firstB[10]).toBeCloseTo(1, 5);
    expect(firstB[15]).toBeCloseTo(1, 5);
  }

  // Full page reload + hard flush, then same pair again should match the first baseline.
  await hardResetBrowserState(page);
  await page.reload();
  await loadPair(page, '6XU6.cif', '6xu8.cif');

  const second = await captureAlignedTransformCheckpoint(page, 'initial-load-second');
  const secondA = flattenTransform(second?.viewerA?.transforms?.aligned);
  const secondB = flattenTransform(second?.viewerB?.transforms?.aligned);

  expect(secondA.length).toBe(firstA.length);
  expect(secondB.length).toBe(firstB.length);

  if (firstA.length === 16 && secondA.length === 16) {
    for (let i = 0; i < 16; i += 1) {
      expect(secondA[i]).toBeCloseTo(firstA[i], 5);
    }
  }
  if (firstB.length === 16 && secondB.length === 16) {
    for (let i = 0; i < 16; i += 1) {
      expect(secondB[i]).toBeCloseTo(firstB[i], 5);
    }
  }
});
