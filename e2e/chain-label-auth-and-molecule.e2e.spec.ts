/**
 * Playwright E2E test to verify chain labels retain auth IDs and append molecule names.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-07-28
 */
import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Select Chain labels include auth code and molecule name for 6XU6', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await page.locator('#viewer-column-A-alignedto-load-btn').click();
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles(dataPath('6XU6.cif'));
  await expect(page.getByRole('button', { name: /Hide 6XU6/i })).toBeVisible({ timeout: 30000 });

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');

  const uniprotToggle = page.locator('#viewer-column-A-alignedto-show-uniprot-accession');
  await expect(uniprotToggle).toBeVisible();
  await expect(uniprotToggle).toContainText(/Include UniProt accession in chain labels:/i);
  if (await uniprotToggle.getAttribute('aria-pressed') === 'false') {
    await uniprotToggle.click();
  }

  const chainTable = page.locator('#viewer-column-A-chain-table-container');
  await expect(chainTable).toBeVisible({ timeout: 30000 });

  await expect(async () => {
    const rowTexts = await page.locator('#viewer-column-A-chain-table tbody tr td').evaluateAll(
      cols => cols.map(c => (c.textContent || '').trim()).filter(Boolean)
    );
    const target = rowTexts.find(
      text => text.includes('ZB [auth CU]') && text.includes('Ribosomal protein L22-like protein')
    );
    expect(target).toBeTruthy();
  }).toPass({ timeout: 30000 });
});
