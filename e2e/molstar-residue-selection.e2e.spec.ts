/**
 * Playwright E2E test to ensure residue picks and removals mirror between viewers for AlignedTo structures.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { expect, test, type Page } from '@playwright/test';
import path from 'path';
import { nativeClippingLaunchOptions } from './helpers/native-clipping';

test.use({ launchOptions: nativeClippingLaunchOptions });
test.describe.configure({ timeout: 120000 });

test('AlignedTo residue picks and removals mirror between viewers', async ({ page }) => {
  await page.goto('/');
  await page.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6XU6.cif'));
  const left = page.locator('#viewer-column-A');
  const right = page.locator('#viewer-column-B');
  await right.getByRole('button', { name: /Show 6XU6/i }).click();

  const openSequence = async (column: 'A' | 'B') => {
    const viewer = page.locator(`#viewer-column-${column}`);
    await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
    const sequence = viewer.getByTestId(`viewer-column-${column}-advanced-molstar-controls-panel`).locator('.msp-sequence');
    await sequence.getByTitle(/^\[Entity\]/).selectOption('0|78');
    await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bZB\b.*\bauth CU\b/);
    return sequence.locator('[data-seqid="0"]').filter({ hasText: 'F' });
  };
  const leftPhe = await openSequence('A');
  const rightPhe = await openSequence('B');
  const marker = /msp-sequence-residue-selected/;
  await right.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await rightPhe.click();
  await expect(rightPhe).toHaveClass(marker);
  await expect(leftPhe).toHaveClass(marker);

  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  const chain = left.getByTestId('viewer-column-A-chain-table-row-CU');
  await expect(chain).toHaveClass(/\bselected\b/);
  await left.getByRole('button', { name: 'Show Residue Controls' }).click();
  const residues = left.locator('#viewer-column-A-alignedto-residue-select option:checked');
  await expect(residues).toHaveText(['PHE 1 [auth 194]']);
  const leftHighlight = left.locator('#viewer-column-A-alignedto-highlight-residue-btn');
  await expect(leftHighlight).toHaveAttribute('aria-pressed', 'true');

  await rightPhe.click();
  await expect(rightPhe).not.toHaveClass(marker);
  await expect(leftPhe).not.toHaveClass(marker);
  await expect(residues).toHaveCount(0);
  await expect(chain).toHaveClass(/\bselected\b/);

  await left.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await leftPhe.click();
  await expect(rightPhe).toHaveClass(marker);
  await expect(residues).toHaveText(['PHE 1 [auth 194]']);
  await rightPhe.click();
  await expect(leftPhe).not.toHaveClass(marker);
  await expect(rightPhe).not.toHaveClass(marker);
  await expect(residues).toHaveCount(0);

  await rightPhe.click();
  await expect(leftPhe).toHaveClass(marker);
  await leftPhe.click();
  await expect(rightPhe).not.toHaveClass(marker);
  await expect(residues).toHaveCount(0);

  await rightPhe.click();
  await expect(leftPhe).toHaveClass(marker);
  await leftHighlight.click();
  await expect(leftPhe).not.toHaveClass(marker);
  await expect(rightPhe).not.toHaveClass(marker);
  await expect(residues).toHaveText(['PHE 1 [auth 194]']);
});

async function loadAlignedToAndPickPhe(page: Page) {
  await page.goto('/');
  await page.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6XU6.cif'));

  const viewer = page.locator('#viewer-column-A');
  await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const sequence = viewer.getByTestId('viewer-column-A-advanced-molstar-controls-panel').locator('.msp-sequence');
  const entity = sequence.getByTitle(/^\[Entity\]/);
  await entity.selectOption('0|78');
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bZB\b.*\bauth CU\b/);

  await viewer.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  const phe = sequence.locator('[data-seqid="0"]').filter({ hasText: 'F' });
  await phe.click();

  await viewer.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Chain Controls' }).click();
  await viewer.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await expect(viewer.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);

  await viewer.getByRole('button', { name: 'Show Residue Controls' }).click();
  await viewer.locator('#viewer-column-A-alignedto-residue-type-details-PHE-btn').click();
  const pheList = viewer.locator('#viewer-column-A-alignedto-residue-type-details-PHE-panel');
  const residue = pheList.getByRole('checkbox', { name: 'PHE 1 [auth 194]', exact: true });
  await expect(residue).toBeChecked();
  await expect(pheList.getByRole('checkbox', { checked: true })).toHaveCount(1);
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  return { viewer, sequence, entity, phe, pheList, residue };
}

test('right Mol* viewer synchronizes Aligned residue picks without changing AlignedTo', async ({ page }) => {
  // Loading and rendering both structures can take longer with parallel software WebGL workers.
  test.setTimeout(300000);
  const { viewer: left, phe, residue } = await loadAlignedToAndPickPhe(page);
  const right = page.locator('#viewer-column-B');
  await right.locator('#viewer-column-B-aligned-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6xu8.cif'));
  await expect(right.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 90000 });

  await right.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const sequence = right.getByTestId('viewer-column-B-advanced-molstar-controls-panel').locator('.msp-sequence');
  const structure = sequence.getByTitle(/^\[Structure\]/);
  await structure.selectOption({ label: await structure.locator('option').filter({ hasText: /6XU8/i }).innerText() });
  await sequence.getByTitle(/^\[Entity\]/).selectOption('0|76');
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bXB\b.*\bauth CU\b/);

  const marker = /msp-sequence-residue-selected/;
  const ser = sequence.locator('[data-seqid="0"]').filter({ hasText: 'S' });
  const leu = sequence.locator('[data-seqid="1"]').filter({ hasText: 'L' });
  const arg = sequence.locator('[data-seqid="2"]').filter({ hasText: 'R' });
  await right.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await ser.click();
  await expect(ser).toHaveClass(marker);
  await leu.click();
  await expect(leu).toHaveClass(marker);
  await arg.click();
  await expect(arg).toHaveClass(marker);
  await expect(ser).toHaveClass(marker);
  await expect(phe).toHaveClass(marker);
  await expect(residue).toBeChecked();

  await right.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await right.getByRole('button', { name: 'Show Chain Controls' }).click();
  await right.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  const chain = right.getByTestId('viewer-column-B-chain-table-row-CU');
  await expect(chain).toHaveClass(/\bselected\b/);
  await right.getByRole('button', { name: 'Show Residue Controls' }).click();
  const selected = right.locator('#viewer-column-B-aligned-residue-select option:checked');
  const highlight = right.locator('#viewer-column-B-aligned-highlight-residue-btn');
  await expect(selected).toHaveText(['SER 1 [auth 190]', 'LEU 2 [auth 191]', 'ARG 3 [auth 192]']);
  await expect(highlight).toHaveAttribute('aria-pressed', 'true');

  await left.getByRole('button', { name: /Show 6XU8/i }).click();
  const leftSequence = left.getByTestId('viewer-column-A-advanced-molstar-controls-panel').locator('.msp-sequence');
  const leftStructure = leftSequence.getByTitle(/^\[Structure\]/);
  const showLeftSequence = async (label: RegExp, entity: string, chain: RegExp) => {
    const option = leftStructure.locator('option').filter({ hasText: label });
    await leftStructure.selectOption({ label: await option.innerText() });
    await leftSequence.getByTitle(/^\[Entity\]/).selectOption(entity);
    await expect(leftSequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', chain);
  };
  await showLeftSequence(/6XU8/i, '0|76', /\bXB\b.*\bauth CU\b/);
  const leftSer = leftSequence.locator('[data-seqid="0"]').filter({ hasText: 'S' });
  const leftLeu = leftSequence.locator('[data-seqid="1"]').filter({ hasText: 'L' });
  const leftArg = leftSequence.locator('[data-seqid="2"]').filter({ hasText: 'R' });
  for (const picked of [leftSer, leftLeu, leftArg]) await expect(picked).toHaveClass(marker);

  await leftLeu.click();
  await expect(leu).not.toHaveClass(marker);
  await expect(ser).toHaveClass(marker);
  await expect(arg).toHaveClass(marker);
  await expect(selected).toHaveText(['SER 1 [auth 190]', 'ARG 3 [auth 192]']);
  await leftLeu.click();
  await expect(leu).toHaveClass(marker);
  await expect(selected).toHaveText(['SER 1 [auth 190]', 'LEU 2 [auth 191]', 'ARG 3 [auth 192]']);
  await leu.click();
  await expect(leftLeu).not.toHaveClass(marker);
  await ser.click();
  await arg.click();
  for (const picked of [ser, arg, leftSer, leftArg]) await expect(picked).not.toHaveClass(marker);
  await expect(selected).toHaveCount(0);
  await expect(highlight).toHaveAttribute('aria-pressed', 'false');
  await expect(chain).toHaveClass(/\bselected\b/);
  await expect(left.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);
  await expect(residue).toBeChecked();
  await showLeftSequence(/6XU6/i, '0|78', /\bZB\b.*\bauth CU\b/);
  await expect(phe).toHaveClass(marker);
});

test('Mol* and Ribocode synchronize additions and removals on the same chain', async ({ page }) => {
  const { viewer, sequence, phe, pheList, residue } = await loadAlignedToAndPickPhe(page);
  const residueHighlight = viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn');
  const chainHighlight = viewer.locator('#viewer-column-A-alignedto-highlight-chain-btn');
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'true');
  await expect(chainHighlight).toHaveAttribute('aria-pressed', 'false');

  const val = sequence.locator('[data-seqid="1"]').filter({ hasText: 'V' });
  await val.click();
  await viewer.locator('#viewer-column-A-alignedto-residue-type-details-VAL-btn').click();
  const valList = viewer.locator('#viewer-column-A-alignedto-residue-type-details-VAL-panel');
  const valResidue = valList.getByRole('checkbox', { name: 'VAL 2 [auth 195]', exact: true });
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  await expect(val).toHaveClass(/msp-sequence-residue-selected/);
  await expect(residue).toBeChecked();
  await expect(valResidue).toBeChecked();
  await expect(pheList.getByRole('checkbox', { checked: true })).toHaveCount(1);
  await expect(valList.getByRole('checkbox', { checked: true })).toHaveCount(1);
  await expect(viewer.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'true');
  await expect(chainHighlight).toHaveAttribute('aria-pressed', 'false');

  const ile = sequence.locator('[data-seqid="2"]').filter({ hasText: 'I' });
  await viewer.locator('#viewer-column-A-alignedto-residue-type-details-ILE-btn').click();
  const ileResidue = viewer.getByRole('checkbox', { name: 'ILE 3 [auth 196]', exact: true });
  await ileResidue.check();
  await expect(ile).toHaveClass(/msp-sequence-residue-selected/);
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  await expect(val).toHaveClass(/msp-sequence-residue-selected/);
  await ileResidue.uncheck();
  await expect(ile).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'true');
  await ileResidue.check();
  await expect(ile).toHaveClass(/msp-sequence-residue-selected/);

  const fourth = sequence.locator('[data-seqid="3"]');
  await fourth.click();
  await expect(fourth).toHaveClass(/msp-sequence-residue-selected/);
  await expect(ileResidue).toBeChecked();
  await expect(ile).toHaveClass(/msp-sequence-residue-selected/);

  await viewer.getByTitle(/^Remove\/Subtract Selection/).click();
  await viewer.getByRole('button', { name: 'Helpers', exact: true }).click();
  await viewer.getByRole('button', { name: 'Atom/Residue Identifier List' }).click();
  await viewer.locator('.msp-selection-viewport-controls-actions').getByRole('textbox').fill('CU 195');
  await viewer.getByRole('button', { name: 'Remove Selection', exact: true }).click();
  await expect(val).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(valResidue).not.toBeChecked();
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  await expect(ile).toHaveClass(/msp-sequence-residue-selected/);
  await expect(residue).toBeChecked();
  await expect(ileResidue).toBeChecked();
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'true');

  await residueHighlight.click();
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'false');
  await expect(phe).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(val).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(ile).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(fourth).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(residue).toBeChecked();
  await expect(valResidue).not.toBeChecked();
  await expect(ileResidue).toBeChecked();
  await expect(chainHighlight).toHaveAttribute('aria-pressed', 'false');

  await phe.click();
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  await expect(ileResidue).not.toBeChecked();
  await phe.click();
  await expect(phe).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(viewer.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);
  await expect(residue).not.toBeChecked();
  await expect(residueHighlight).toHaveAttribute('aria-pressed', 'false');
  await expect(viewer.locator('#viewer-column-A-alignedto-residue-select option:checked')).toHaveCount(0);
});

test('Mol* picks fill Select 2 and deselecting residues preserves both chain slots', async ({ page }) => {
  const { viewer, sequence, entity, phe, pheList, residue } = await loadAlignedToAndPickPhe(page);
  const slot2Chain = viewer.getByTestId('viewer-column-A-alignedto-chain2-chain-table-row-AQ');
  await viewer.locator('#viewer-column-A-alignedto-select-chain2-controls-toggle-btn').click();
  await expect(slot2Chain).toBeVisible();
  await expect(viewer.locator('[data-testid^="viewer-column-A-alignedto-chain2-chain-table-row-"].selected')).toHaveCount(0);

  await entity.selectOption('0|64');
  await expect(entity).toHaveAttribute('title', /40S ribosomal protein S16/);
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bLB\b.*\bauth AQ\b/);
  const met = sequence.locator('[data-seqid="0"]').filter({ hasText: 'M' });
  await met.click();
  await expect(met).toHaveClass(/msp-sequence-residue-selected/);

  await entity.selectOption('0|78');
  await expect(phe).toHaveClass(/msp-sequence-residue-selected/);
  await expect(viewer.getByTestId('viewer-column-A-chain-table-row-CU')).toHaveClass(/\bselected\b/);
  await expect(residue).toBeChecked();
  await expect(pheList.getByRole('checkbox', { checked: true })).toHaveCount(1);

  await expect(slot2Chain).toHaveClass(/\bselected\b/);
  await viewer.locator('#viewer-column-A-alignedto-residue2-controls-toggle-btn').click();
  const selectedInSlot2 = viewer.locator('#viewer-column-A-alignedto-residue2-select option:checked');
  await expect(selectedInSlot2).toHaveText(['MET 1 [auth 1]']);
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue2-btn')).toHaveAttribute('aria-pressed', 'true');

  await phe.click();
  await expect(phe).not.toHaveClass(/msp-sequence-residue-selected/);
  const cuInSlot1 = viewer.getByTestId('viewer-column-A-chain-table-row-CU');
  await expect(cuInSlot1).toHaveClass(/\bselected\b/);
  await expect(slot2Chain).toHaveClass(/\bselected\b/);
  const selectedInSlot1 = viewer.locator('#viewer-column-A-alignedto-residue-select option:checked');
  await expect(selectedInSlot1).toHaveCount(0);
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(selectedInSlot2).toHaveText(['MET 1 [auth 1]']);
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue2-btn')).toHaveAttribute('aria-pressed', 'true');

  await entity.selectOption('0|64');
  await expect(met).toHaveClass(/msp-sequence-residue-selected/);
  await met.click();
  await expect(met).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(slot2Chain).toHaveClass(/\bselected\b/);
  await expect(cuInSlot1).toHaveClass(/\bselected\b/);
  await expect(selectedInSlot2).toHaveCount(0);
  await expect(selectedInSlot1).toHaveCount(0);
  await expect(viewer.locator('#viewer-column-A-alignedto-highlight-residue2-btn')).toHaveAttribute('aria-pressed', 'false');
});
