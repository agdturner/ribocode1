import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Clip Radius stays consistent while clipping controls remain open after zoom', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });

  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await page.click('#viewer-column-B-aligned-load-btn');
  await expect(page.locator('#viewer-column-B-aligned-filename-label')).toHaveText(/6xu8\.cif/i, { timeout: 30000 });

  await page.click('#viewer-column-B-clipping-controls-toggle-btn');
  const clipRadiusInput = page.locator('#viewer-column-B-aligned-clip-far-number');
  await expect(clipRadiusInput).toBeVisible();

  await page.click('#viewer-column-B-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-chain-controls-toggle-btn');
  await page.click('#viewer-column-B-aligned-select-chain-controls-toggle-btn');

  await expect(page.locator('#viewer-column-B-chain-table-container')).toBeVisible({ timeout: 30000 });
  const availableChainValue = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-testid^="viewer-column-B-chain-table-row-"]'));
    const first = rows[0]?.getAttribute('data-testid') || '';
    return first.replace('viewer-column-B-chain-table-row-', '');
  });
  expect(availableChainValue).not.toBe('');
  await page.click(`[data-testid="viewer-column-B-chain-table-row-${availableChainValue}"]`);

  await page.click('#viewer-column-B-aligned-zoom-chain-btn');

  await expect(async () => {
    const whileOpen = await clipRadiusInput.inputValue();

    await page.click('#viewer-column-B-clipping-controls-toggle-btn');
    await page.click('#viewer-column-B-clipping-controls-toggle-btn');

    const afterReopen = await clipRadiusInput.inputValue();
    expect(whileOpen).toBe(afterReopen);
  }).toPass({ timeout: 5000 });
});
