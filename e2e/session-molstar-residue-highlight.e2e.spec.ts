/**
 * Verify a Mol* residue selection remains highlighted after a session round trip.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-26
 */
import { expect, test } from '@playwright/test';
import path from 'path';
import { nativeClippingLaunchOptions } from './helpers/native-clipping';

test.use({ launchOptions: nativeClippingLaunchOptions });
test.describe.configure({ timeout: 240000 });

test('Save All and Load All restore a Mol* residue selection and highlight', async ({ page }) => {
  const viewer = page.locator('#viewer-column-A');
  const marker = /msp-sequence-residue-selected/;
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await viewer.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6XU6.cif'));
  await expect(viewer.getByRole('button', { name: 'Hide 6XU6', exact: true })).toBeVisible({ timeout: 90000 });

  await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const sequence = viewer.getByTestId('viewer-column-A-advanced-molstar-controls-panel').locator('.msp-sequence');
  await sequence.getByTitle(/^\[Entity\]/).selectOption('0|78');
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bZB\b.*\bauth CU\b/);
  const phe = sequence.locator('[data-seqid="0"]').filter({ hasText: 'F' });
  await viewer.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await phe.click();
  await expect(phe).toHaveClass(marker);

  await viewer.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Chain Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await expect(viewer.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);
  await viewer.getByRole('button', { name: 'Show Residue Controls' }).click();
  await expect(viewer.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['PHE 1 [auth 194]']);
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'true');

  await page.click('#session-menu-btn');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save All")').click();
  const sessionPath = await (await downloadPromise).path();
  expect(sessionPath).toBeTruthy();

  await page.reload();
  await page.locator('#session-menu-file-input-all').setInputFiles(sessionPath!);
  await expect(viewer.getByRole('button', { name: 'Hide 6XU6', exact: true })).toBeVisible({ timeout: 90000 });
  await viewer.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Chain Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await viewer.getByRole('button', { name: 'Show Residue Controls' }).click();
  await expect(viewer.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['PHE 1 [auth 194]'], { timeout: 30000 });

  await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  await sequence.getByTitle(/^\[Entity\]/).selectOption('0|78');
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bZB\b.*\bauth CU\b/);
  await expect(phe).toHaveClass(marker, { timeout: 30000 });
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn'))
    .toHaveAttribute('aria-pressed', 'true');

  const right = page.locator('#viewer-column-B');
  await right.getByRole('button', { name: 'Show 6XU6', exact: true }).click();
  await right.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const rightSequence = right.getByTestId('viewer-column-B-advanced-molstar-controls-panel').locator('.msp-sequence');
  await rightSequence.getByTitle(/^\[Entity\]/).selectOption('0|78');
  const rightPhe = rightSequence.locator('[data-seqid="0"]').filter({ hasText: 'F' });
  await expect(rightPhe).toHaveClass(marker);

  await viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn').click();
  await expect(phe).not.toHaveClass(marker);
  await expect(rightPhe).not.toHaveClass(marker);
  await expect(viewer.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['PHE 1 [auth 194]']);

  await page.click('#session-menu-btn');
  const offDownloadPromise = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save All")').click();
  const offSessionPath = await (await offDownloadPromise).path();
  expect(offSessionPath).toBeTruthy();

  await page.locator('#session-menu-file-input-all').setInputFiles(offSessionPath!);
  await expect(viewer.getByRole('button', { name: 'Hide 6XU6', exact: true })).toBeVisible({ timeout: 90000 });
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn'))
    .toHaveAttribute('aria-pressed', 'false', { timeout: 30000 });
  await expect(viewer.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['PHE 1 [auth 194]'], { timeout: 30000 });
  await expect(phe).not.toHaveClass(marker);
  await expect(rightPhe).not.toHaveClass(marker);
});

test('Save All restores independent native highlights from both datasets and viewers', async ({ page }) => {
  test.setTimeout(300000);
  const left = page.locator('#viewer-column-A');
  const right = page.locator('#viewer-column-B');
  const marker = /msp-sequence-residue-selected/;
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await left.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6XU6.cif'));
  await expect(left.getByRole('button', { name: 'Hide 6XU6', exact: true })).toBeVisible({ timeout: 90000 });
  await right.locator('#viewer-column-B-aligned-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6xu8.cif'));
  await expect(right.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 90000 });

  const selectSequence = async (viewer: typeof left, column: 'A' | 'B', structureName: RegExp, entity: string) => {
    const sequence = viewer.getByTestId(`viewer-column-${column}-advanced-molstar-controls-panel`).locator('.msp-sequence');
    const structure = sequence.getByTitle(/^\[Structure\]/);
    const option = structure.locator('option').filter({ hasText: structureName });
    await structure.selectOption({ label: await option.innerText() });
    await sequence.getByTitle(/^\[Entity\]/).selectOption(entity);
    return sequence;
  };
  await left.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const leftSequence = await selectSequence(left, 'A', /6XU6/i, '0|78');
  const phe = leftSequence.locator('[data-seqid="0"]').filter({ hasText: 'F' });
  await left.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await phe.click();
  await expect(phe).toHaveClass(marker);

  await right.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const rightSequence = await selectSequence(right, 'B', /6XU8/i, '0|76');
  const ser = rightSequence.locator('[data-seqid="0"]').filter({ hasText: 'S' });
  await right.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await ser.click();
  await expect(ser).toHaveClass(marker);
  await expect(phe).toHaveClass(marker);

  await page.click('#session-menu-btn');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save All")').click();
  const sessionPath = await (await downloadPromise).path();
  expect(sessionPath).toBeTruthy();

  await page.reload();
  await page.locator('#session-menu-file-input-all').setInputFiles(sessionPath!);
  await expect(left.getByRole('button', { name: 'Hide 6XU6', exact: true })).toBeVisible({ timeout: 90000 });
  await expect(right.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  await right.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  await selectSequence(left, 'A', /6XU6/i, '0|78');
  await selectSequence(right, 'B', /6XU8/i, '0|76');
  await expect(phe).toHaveClass(marker, { timeout: 30000 });
  await expect(ser).toHaveClass(marker, { timeout: 30000 });
});
