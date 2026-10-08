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

  const uniprotToggle = page.locator('#generalcontrols-show-uniprot-accession');
  await expect(uniprotToggle).toBeVisible();
  await uniprotToggle.check();

  await page.locator('#viewer-column-A-alignedto-load-btn').click();
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles(dataPath('6XU6.cif'));
  await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/6xu6\.cif/i);

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');

  const chainSelect = page.locator('#viewer-column-A-alignedto-chain-select');
  await expect(chainSelect).toBeEnabled({ timeout: 30000 });

  await expect(async () => {
    const optionTexts = await page.locator('#viewer-column-A-alignedto-chain-select option').evaluateAll(
      options => options.map(o => (o.textContent || '').trim()).filter(Boolean)
    );
    const target = optionTexts.find(
      text => text.includes('ZB [auth CU]') && text.includes('Ribosomal protein L22-like protein')
    );
    expect(target).toBeTruthy();
  }).toPass({ timeout: 30000 });
});
