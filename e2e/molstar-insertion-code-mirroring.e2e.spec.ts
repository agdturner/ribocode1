/**
 * Verify that Mol* selections distinguish residues with insertion codes.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.2.0
 * @lastModified 2026-11-26
 */
import { expect, test } from '@playwright/test';
import { nativeClippingLaunchOptions } from './helpers/native-clipping';

const cif = `data_insertions
loop_
_entity.id
_entity.type
1 polymer
loop_
_entity_poly.entity_id
_entity_poly.type
_entity_poly.pdbx_seq_one_letter_code_can
1 'polypeptide(L)' GAS
loop_
_entity_poly_seq.entity_id
_entity_poly_seq.num
_entity_poly_seq.mon_id
1 1 GLY
1 2 ALA
1 3 SER
loop_
_struct_asym.id
_struct_asym.entity_id
A 1
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_entity_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
ATOM 1 C CA . GLY A 1 1 ? 0 0 0 1 10 194 A 1
ATOM 2 C CA . ALA A 1 2 A 3 0 0 1 10 194 A 1
ATOM 3 C CA . SER A 1 3 B 6 0 0 1 10 194 A 1
`;

test.use({ launchOptions: nativeClippingLaunchOptions });
test.describe.configure({ timeout: 120000 });

test('additional slot preserves distinct insertion codes and Mol* markers', async ({ page }) => {
  const fourChains = cif.replace('A 1\nloop_\n_atom_site', 'A 1\nB 1\nC 1\nD 1\nloop_\n_atom_site')
    + 'ATOM 4 C CA . GLY B 1 1 ? 0 3 0 1 10 1 B 1\n'
    + 'ATOM 5 C CA . GLY C 1 1 ? 0 6 0 1 10 1 C 1\n'
    + 'ATOM 6 C CA . GLY D 1 1 ? 0 9 0 1 10 1 D 1\n';
  const left = page.locator('#viewer-column-A');
  const prefix = 'viewer-column-A-alignedto';
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await left.locator(`#${prefix}-file-input`).setInputFiles({
    name: 'four-chains.cif', mimeType: 'chemical/x-cif', buffer: Buffer.from(fourChains),
  });
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.locator(`#${prefix}-select-chain-controls-toggle-btn`).click();
  await left.getByTestId('viewer-column-A-chain-table-row-B').click();
  await left.locator(`#${prefix}-residue-controls-toggle-btn`).click();
  const firstSlotSelect = left.locator(`#${prefix}-residue-select`);
  await expect(firstSlotSelect.locator('option')).toHaveCount(1);
  await expect(firstSlotSelect.locator('option:checked')).toHaveCount(1);
  await firstSlotSelect.selectOption([]);
  for (const [slot, chain] of [[2, 'C'], [3, 'D'], [4, 'A']] as const) {
    await left.locator(`#${prefix}-select-chain${slot}-controls-toggle-btn`).click();
    await left.getByTestId(`${prefix}-chain${slot}-chain-table-row-${chain}`).click();
  }
  await left.locator(`#${prefix}-residue4-controls-toggle-btn`).click();
  const select = left.locator(`#${prefix}-residue4-select`);
  await expect(select.locator('option')).toHaveCount(3);
  await left.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const sequence = left.getByTestId('viewer-column-A-advanced-molstar-controls-panel').locator('.msp-sequence');
  await expect(sequence.getByTitle(/^\[Chain\]/)).toHaveAttribute('title', /\bA\b/);
  await left.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await sequence.locator('[data-seqid="1"]').filter({ hasText: 'A' }).click();
  await expect(select.locator('option:checked')).toHaveText(['ALA 2A [auth 194]']);
  await select.selectOption(['194', '194:B']);
  await expect(select.locator('option:checked')).toHaveText(['GLY 1 [auth 194]', 'SER 3B [auth 194]']);
  await expect(sequence.locator('[data-seqid="0"]').filter({ hasText: 'G' })).toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="1"]').filter({ hasText: 'A' })).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="2"]').filter({ hasText: 'S' })).toHaveClass(/msp-sequence-residue-selected/);
  const inspect = left.locator(`#${prefix}-inspect-residue4-btn`);
  await inspect.click();
  await expect(inspect).toHaveAttribute('aria-pressed', 'true');

  await page.click('#session-menu-btn');
  const download = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save All")').click();
  const sessionPath = await (await download).path();
  expect(sessionPath).toBeTruthy();
  await page.reload();
  await page.locator('#session-menu-file-input-all').setInputFiles(sessionPath!);
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.locator(`#${prefix}-select-chain-controls-toggle-btn`).click();
  await left.locator(`#${prefix}-residue-controls-toggle-btn`).click();
  await expect(firstSlotSelect.locator('option')).toHaveCount(1);
  await expect(firstSlotSelect.locator('option:checked')).toHaveCount(0);
  await expect(left.locator(`#${prefix}-selected-chain4-label`)).toContainText('A');
  await left.locator(`#${prefix}-select-chain4-controls-toggle-btn`).click();
  await left.locator(`#${prefix}-residue4-controls-toggle-btn`).click();
  await expect(select.locator('option:checked')).toHaveText(['GLY 1 [auth 194]', 'SER 3B [auth 194]']);
  await expect(inspect).toHaveAttribute('aria-pressed', 'true');

  await page.click('#session-menu-btn');
  const saveDownload = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save")').click();
  const savePath = await (await saveDownload).path();
  expect(savePath).toBeTruthy();
  await page.reload();
  await page.locator('#session-menu-file-input').setInputFiles(savePath!);
  await expect(page.getByText('Load Session: Select Required Files')).toBeVisible();
  await page.locator('[data-testid^="session-load-modal-file-input-"]').setInputFiles({
    name: 'four-chains.cif', mimeType: 'chemical/x-cif', buffer: Buffer.from(fourChains),
  });
  await page.getByTestId('session-load-modal-load-btn').click();
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.locator(`#${prefix}-select-chain-controls-toggle-btn`).click();
  await left.locator(`#${prefix}-residue-controls-toggle-btn`).click();
  await expect(firstSlotSelect.locator('option')).toHaveCount(1);
  await expect(firstSlotSelect.locator('option:checked')).toHaveCount(0);
  await left.locator(`#${prefix}-select-chain4-controls-toggle-btn`).click();
  await left.locator(`#${prefix}-residue4-controls-toggle-btn`).click();
  await expect(select.locator('option:checked')).toHaveText(['GLY 1 [auth 194]', 'SER 3B [auth 194]']);
});

test('mirrors distinct insertion codes and restores them across a session', async ({ page }) => {
  const left = page.locator('#viewer-column-A');
  const right = page.locator('#viewer-column-B');
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await left.locator('#viewer-column-A-alignedto-file-input').setInputFiles({
    name: 'insertions.cif', mimeType: 'chemical/x-cif', buffer: Buffer.from(cif),
  });
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await right.getByRole('button', { name: /Show insertions/i }).click();
  const sequence = async (viewer: typeof left, column: 'A' | 'B') => {
    await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
    return viewer.getByTestId(`viewer-column-${column}-advanced-molstar-controls-panel`).locator('.msp-sequence');
  };
  const leftSequence = await sequence(left, 'A');
  const rightSequence = await sequence(right, 'B');
  const leftAla = leftSequence.locator('[data-seqid="1"]').filter({ hasText: 'A' });
  const leftGly = leftSequence.locator('[data-seqid="0"]').filter({ hasText: 'G' });
  const leftSer = leftSequence.locator('[data-seqid="2"]').filter({ hasText: 'S' });
  const rightAla = rightSequence.locator('[data-seqid="1"]').filter({ hasText: 'A' });
  const rightGly = rightSequence.locator('[data-seqid="0"]').filter({ hasText: 'G' });
  const rightSer = rightSequence.locator('[data-seqid="2"]').filter({ hasText: 'S' });
  const marker = /msp-sequence-residue-selected/;
  await left.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await leftAla.click();
  await expect(leftAla).toHaveClass(marker);
  await expect(rightAla).toHaveClass(marker);
  await expect(rightGly).not.toHaveClass(marker);
  await expect(rightSer).not.toHaveClass(marker);

  await leftGly.click();
  await leftSer.click();
  await expect(rightGly).toHaveClass(marker);
  await expect(rightSer).toHaveClass(marker);
  await leftAla.click();
  await expect(rightAla).not.toHaveClass(marker);
  await expect(rightGly).toHaveClass(marker);
  await expect(rightSer).toHaveClass(marker);

  await right.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await rightGly.click();
  await expect(leftGly).not.toHaveClass(marker);
  await expect(leftSer).toHaveClass(marker);
  await rightAla.click();
  await expect(leftAla).toHaveClass(marker);
  await expect(leftSer).toHaveClass(marker);

  await page.click('#session-menu-btn');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save All")').click();
  const sessionPath = await (await downloadPromise).path();
  expect(sessionPath).toBeTruthy();
  await page.reload();
  await page.locator('#session-menu-file-input-all').setInputFiles(sessionPath!);
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await expect(right.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await sequence(left, 'A');
  await sequence(right, 'B');
  await expect(leftAla).toHaveClass(marker);
  await expect(leftSer).toHaveClass(marker);
  await expect(leftGly).not.toHaveClass(marker);
  await expect(rightAla).toHaveClass(marker);
  await expect(rightSer).toHaveClass(marker);
  await expect(rightGly).not.toHaveClass(marker);
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await left.getByRole('button', { name: 'Show Residue Controls' }).click();
  await expect(left.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['ALA 2A [auth 194]', 'SER 3B [auth 194]']);
});

test('residue controls distinguish residues sharing an author number', async ({ page }) => {
  const left = page.locator('#viewer-column-A');
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/');
  await left.locator('#viewer-column-A-alignedto-file-input').setInputFiles({
    name: 'insertions.cif', mimeType: 'chemical/x-cif', buffer: Buffer.from(cif),
  });
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  const sequence = left.getByTestId('viewer-column-A-advanced-molstar-controls-panel').locator('.msp-sequence');
  await left.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await sequence.locator('[data-seqid="1"]').filter({ hasText: 'A' }).click();
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await left.getByRole('button', { name: 'Show Residue Controls' }).click();
  const options = left.locator('#viewer-column-A-alignedto-residue-select option');
  await expect(options).toHaveText(['GLY 1 [auth 194]', 'ALA 2A [auth 194]', 'SER 3B [auth 194]']);
  await expect(left.locator('#viewer-column-A-alignedto-residue-select option:checked'))
    .toHaveText(['ALA 2A [auth 194]']);
  const select = left.locator('#viewer-column-A-alignedto-residue-select');
  await select.selectOption(['194', '194:B']);
  await expect(select.locator('option:checked')).toHaveText(['GLY 1 [auth 194]', 'SER 3B [auth 194]']);
  await expect(sequence.locator('[data-seqid="0"]').filter({ hasText: 'G' })).toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="1"]').filter({ hasText: 'A' })).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="2"]').filter({ hasText: 'S' })).toHaveClass(/msp-sequence-residue-selected/);

  await page.click('#session-menu-btn');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#session-menu-dropdown .session-menu-item:text-is("Save")').click();
  const sessionPath = await (await downloadPromise).path();
  expect(sessionPath).toBeTruthy();
  await page.reload();
  await page.locator('#session-menu-file-input').setInputFiles(sessionPath!);
  await expect(page.getByText('Load Session: Select Required Files')).toBeVisible();
  await page.locator('[data-testid^="session-load-modal-file-input-"]').setInputFiles({
    name: 'insertions.cif', mimeType: 'chemical/x-cif', buffer: Buffer.from(cif),
  });
  await page.getByTestId('session-load-modal-load-btn').click();
  await expect(left.getByRole('button', { name: /Hide insertions/i })).toBeVisible({ timeout: 90000 });
  await left.getByRole('button', { name: 'Show Select and Zoom Controls' }).click();
  await left.getByRole('button', { name: 'Show Chain Controls' }).click();
  await left.getByRole('button', { name: 'Show Select 1', exact: true }).click();
  await left.getByRole('button', { name: 'Show Residue Controls' }).click();
  await expect(select.locator('option:checked')).toHaveText(['GLY 1 [auth 194]', 'SER 3B [auth 194]']);
  await left.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
  await expect(sequence.locator('[data-seqid="0"]').filter({ hasText: 'G' })).toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="1"]').filter({ hasText: 'A' })).not.toHaveClass(/msp-sequence-residue-selected/);
  await expect(sequence.locator('[data-seqid="2"]').filter({ hasText: 'S' })).toHaveClass(/msp-sequence-residue-selected/);
});
