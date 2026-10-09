import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Clip Radius reflects Mol* Reset Zoom camera changes', async ({ page }) => {
  test.fail(true, 'Known issue: clipping controls do not always reflect native Mol* zoom interactions.');

  await page.goto('http://localhost:5173/');

  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });

  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await page.click('#viewer-column-B-aligned-load-btn');
  await expect(page.getByRole('button', { name: /Hide 6XU8/i })).toBeVisible({ timeout: 30000 });

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

  const beforeReset = await clipRadiusInput.inputValue();

  const viewerB = page.locator('#viewer-column-B');
  await viewerB.getByRole('button', { name: 'Reset Zoom' }).click();

  await expect(async () => {
    const afterReset = await clipRadiusInput.inputValue();
    expect(afterReset).not.toBe(beforeReset);
  }).toPass({ timeout: 10000 });
});
