/**
 * E2E test for experimental multi-chain alignment in Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { expect, test } from '@playwright/test';
import path from 'path';

test('experimental multi-chain fit refuses incomplete slots and reports both pairs', async ({ page }) => {
  test.setTimeout(300000);
  await page.addInitScript(() => { (window as any).__RIBOCODE_E2E__ = true; });
  await page.goto('/?experimentalMultiChainAlignment=1');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', path.resolve(__dirname, '../data/input/7WTT.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTT/i })).toBeVisible({ timeout: 120000 });
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', path.resolve(__dirname, '../data/input/7WTZ.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTZ/i })).toBeVisible({ timeout: 120000 });

  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-select-chain-controls-toggle-btn`);
    await page.getByTestId(`viewer-column-${viewer}-chain-table-row-e`).click();
  }
  await page.click('#viewer-column-A-alignedto-select-chain2-controls-toggle-btn');
  await page.getByTestId('viewer-column-A-alignedto-chain2-chain-table-row-E').click();
  await page.click('#generalcontrols-realign-btn');
  const report = page.getByRole('status', { name: 'Experimental multi-chain alignment report' });
  await expect(report).toContainText('Chain slot 2 needs a selection on both sides.');
  expect(await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain)).toBeNull();

  await page.click('#viewer-column-B-aligned-select-chain2-controls-toggle-btn');
  await page.getByTestId('viewer-column-B-aligned-chain2-chain-table-row-E').click();
  await page.click('#generalcontrols-realign-btn');
  await expect(report.getByRole('row')).toHaveCount(3, { timeout: 120000 });
  const rows = report.getByRole('row');
  await expect(rows.nth(1)).toContainText('20 / 55 (36.4%)');
  await expect(rows.nth(1)).toContainText('Warning: residue-key coverage below 50%');
  await expect(rows.nth(2)).toContainText('262 / 262 (100.0%)');
  await expect(rows.nth(2)).not.toContainText('Warning: residue-key coverage below 50%');
  await expect(report).toContainText('Unknown insertion codes were treated as blank');
  const metrics = await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain);
  expect(metrics.atomPairCount).toBe(282);
  expect(metrics.alignedToChainId).toBe('e, E');
  const actualRmsd = async (viewer: 'A' | 'B') => page.evaluate((viewerKey) => {
    const api = (window as any).__ribocodeTestApi;
    const distances: number[] = [];
    for (const chain of ['e', 'E']) {
      const ref = api.getExperimentalVisibleAnchors(viewerKey, 'AlignedTo', chain).filter((a: any) => a.type === 'CA');
      const mov = api.getExperimentalVisibleAnchors(viewerKey, 'Aligned', chain).filter((a: any) => a.type === 'CA');
      const reference = new Map<string, { x: number; y: number; z: number }>(ref.map((a: any) => [a.key, a]));
      mov.forEach((atom: { key: string; x: number; y: number; z: number }) => {
        const point = reference.get(atom.key);
        if (point) distances.push(
          (point.x - atom.x) ** 2 + (point.y - atom.y) ** 2 + (point.z - atom.z) ** 2
        );
      });
    }
    return { count: distances.length, rmsd: Math.sqrt(distances.reduce((a, b) => a + b, 0) / distances.length) };
  }, viewer);
  for (const viewer of ['A', 'B'] as const) {
    const observed = await actualRmsd(viewer);
    expect(observed.count).toBe(282);
    expect(observed.rmsd).toBeCloseTo(metrics.rmsd, 3);
  }
  const coordinates = () => page.evaluate(() => (window as any).__ribocodeTestApi.getExperimentalVisibleAnchors('A', 'Aligned', 'e'));
  const first = await coordinates();
  await page.click('#generalcontrols-realign-btn');
  await expect(report.getByRole('row')).toHaveCount(3, { timeout: 120000 });
  const second = await coordinates();
  for (const axis of ['xs', 'ys', 'zs'] as const) {
    const key = axis === 'xs' ? 'x' : axis === 'ys' ? 'y' : 'z';
    expect(Math.max(...first.map((value: Record<string, number>, i: number) => Math.abs(value[key] - second[i][key])))).toBeLessThan(0.001);
  }
});

test('experimental fit includes three conflicting pairs and handles a dynamic fourth slot', async ({ page }) => {
  test.setTimeout(300000);
  await page.addInitScript(() => { (window as any).__RIBOCODE_E2E__ = true; });
  await page.goto('/?experimentalMultiChainAlignment=1');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', path.resolve(__dirname, '../data/input/7WTT.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTT/i })).toBeVisible({ timeout: 120000 });
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', path.resolve(__dirname, '../data/input/7WTZ.cif'));
  await expect(page.getByRole('button', { name: /Hide 7WTZ/i })).toBeVisible({ timeout: 120000 });
  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-select-chain-controls-toggle-btn`);
    await page.getByTestId(`viewer-column-${viewer}-chain-table-row-T`).click();
    for (const [slot, id] of [[2, 'F'], [3, 'K']] as const) {
      await page.click(`#viewer-column-${viewer}-${mode}-select-chain${slot}-controls-toggle-btn`);
      await page.getByTestId(`viewer-column-${viewer}-${mode}-chain${slot}-chain-table-row-${id}`).click();
    }
  }
  await page.click('#generalcontrols-realign-btn');
  const report = page.getByRole('status', { name: 'Experimental multi-chain alignment report' });
  await expect(report.getByRole('row')).toHaveCount(4, { timeout: 120000 });
  await expect(report.getByRole('row').nth(1)).toContainText('16.291');
  await expect(report.getByRole('row').nth(2)).toContainText('12.510');
  await expect(report.getByRole('row').nth(3)).toContainText('10.796');
  expect((await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain)).atomPairCount).toBe(1242);

  await page.click('#viewer-column-A-alignedto-select-chain4-controls-toggle-btn');
  await page.getByTestId('viewer-column-A-alignedto-chain4-chain-table-row-e').click();
  await page.click('#generalcontrols-realign-btn');
  await expect(report).toContainText('Chain slot 4 needs a selection on both sides.');
  expect(await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain)).toBeNull();
  await page.click('#viewer-column-B-aligned-select-chain4-controls-toggle-btn');
  await page.getByTestId('viewer-column-B-aligned-chain4-chain-table-row-e').click();
  await page.click('#generalcontrols-realign-btn');
  await expect(report.getByRole('row')).toHaveCount(5, { timeout: 120000 });
  await expect(report.getByRole('row').nth(4)).toContainText('20 / 55 (36.4%)');
  expect((await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain)).atomPairCount).toBe(1262);
});

test('CU and CP use mixed correspondence and transform visible coordinates', async ({ page }) => {
  test.setTimeout(300000);
  await page.addInitScript(() => { (window as any).__RIBOCODE_E2E__ = true; });
  await page.goto('/?experimentalMultiChainAlignment=1');
  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', path.resolve(__dirname, '../data/input/6XU6.cif'));
  await expect(page.getByRole('button', { name: /Hide 6XU6/i })).toBeVisible({ timeout: 120000 });
  await page.click('#viewer-column-B-aligned-load-btn');
  await page.setInputFiles('#viewer-column-B-aligned-file-input', path.resolve(__dirname, '../data/input/6xu8.cif'));
  await expect(page.getByRole('button', { name: /Hide 6xu8/i })).toBeVisible({ timeout: 120000 });
  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    await page.click(`#viewer-column-${viewer}-select-zoom-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-chain-controls-toggle-btn`);
    await page.click(`#viewer-column-${viewer}-${mode}-select-chain-controls-toggle-btn`);
    await page.getByTestId(`viewer-column-${viewer}-chain-table-row-CU`).click();
  }
  await page.click('#generalcontrols-realign-btn');
  const report = page.getByRole('status', { name: 'Experimental multi-chain alignment report' });
  await expect(report.getByRole('row')).toHaveCount(2, { timeout: 120000 });
  await expect(report).toContainText('Protein sequence (57.9% identity)');
  await expect(report).toContainText('55 / 96 (57.3%)');
  await expect(report).toContainText('55 / 99 (55.6%)');
  await expect(report).toContainText('does not prove unique or biological correspondence');
  const metrics = await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain);
  expect(metrics.atomPairCount).toBe(55);
  for (const viewer of ['A', 'B'] as const) {
    const observed = await page.evaluate(async (viewerKey) => {
      const api = (window as any).__ribocodeTestApi;
      const modulePath = '/src/utils/experimentalMultiChainAlignment.ts';
      const { fitExperimentalMultiChain } = await import(/* @vite-ignore */ modulePath);
      const { pairs } = fitExperimentalMultiChain([{
        referenceChain: 'CU', movingChain: 'CU',
        reference: api.getExperimentalVisibleAnchors(viewerKey, 'AlignedTo', 'CU'),
        moving: api.getExperimentalVisibleAnchors(viewerKey, 'Aligned', 'CU'),
      }]);
      const sum = pairs.reduce((total: number, pair: any) => total +
        (pair.reference.x - pair.moving.x) ** 2 + (pair.reference.y - pair.moving.y) ** 2 +
        (pair.reference.z - pair.moving.z) ** 2, 0);
      return { count: pairs.length, rmsd: Math.sqrt(sum / pairs.length) };
    }, viewer);
    expect(observed.count).toBe(55);
    expect(observed.rmsd).toBeCloseTo(metrics.rmsd, 3);
  }

  for (const [viewer, mode] of [['A', 'alignedto'], ['B', 'aligned']] as const) {
    await page.click(`#viewer-column-${viewer}-${mode}-select-chain2-controls-toggle-btn`);
    await page.getByTestId(`viewer-column-${viewer}-${mode}-chain2-chain-table-row-CP`).click();
  }
  await page.click('#generalcontrols-realign-btn');
  await expect(report.getByRole('row')).toHaveCount(3, { timeout: 120000 });
  const cu = report.getByRole('row').nth(1);
  const cp = report.getByRole('row').nth(2);
  await expect(cu).toContainText('Protein sequence (57.9% identity)');
  await expect(cu).toContainText('3.134');
  await expect(cu).toContainText('2.850');
  await expect(cp).toContainText('Residue key');
  await expect(cp).toContainText('185 / 185 (100.0%)');
  await expect(cp).toContainText('2.082');
  await expect(cp).toContainText('1.841');
  await expect(report).not.toContainText('Warning: residue-key coverage below 50%');
  await expect(report).toContainText('Unknown insertion codes were treated as blank');
  const mixedMetrics = await page.evaluate(() => (window as any).__ribocodeTestApi.getLastRealignMetrics().chain);
  expect(mixedMetrics.atomPairCount).toBe(240);
  for (const viewer of ['A', 'B'] as const) {
    const observed = await page.evaluate(async (viewerKey) => {
      const api = (window as any).__ribocodeTestApi;
      const modulePath = '/src/utils/experimentalMultiChainAlignment.ts';
      const { fitExperimentalMultiChain } = await import(/* @vite-ignore */ modulePath);
      const { pairs, reports } = fitExperimentalMultiChain(['CU', 'CP'].map(chain => ({
        referenceChain: chain, movingChain: chain,
        reference: api.getExperimentalVisibleAnchors(viewerKey, 'AlignedTo', chain),
        moving: api.getExperimentalVisibleAnchors(viewerKey, 'Aligned', chain),
      })));
      const sums = [pairs.slice(0, reports[0].pairs), pairs.slice(reports[0].pairs)].map(group =>
        group.reduce((total: number, pair: any) => total +
          (pair.reference.x - pair.moving.x) ** 2 + (pair.reference.y - pair.moving.y) ** 2 +
          (pair.reference.z - pair.moving.z) ** 2, 0));
      return { counts: reports.map((row: any) => row.pairs),
        rmsds: sums.map((sum, i) => Math.sqrt(sum / reports[i].pairs)),
        rmsd: Math.sqrt((sums[0] + sums[1]) / pairs.length) };
    }, viewer);
    expect(observed.counts).toEqual([55, 185]);
    expect(observed.rmsds[0]).toBeCloseTo(3.134, 2);
    expect(observed.rmsds[1]).toBeCloseTo(2.082, 2);
    expect(observed.rmsd).toBeCloseTo(mixedMetrics.rmsd, 3);
  }
});
