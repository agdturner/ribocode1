import { test, expect } from '@playwright/test';
import path from 'path';

function dataPath(filename: string) {
  return path.resolve(__dirname, '../data/input', filename);
}

test('Clip Radius reflects Mol* selection-mode plus reset-zoom camera changes', async ({ page }) => {
  test.fixme(true, 'Known issue: clipping controls do not always reflect native Mol* zoom interactions.');
  test.setTimeout(90000);

  await page.goto('http://localhost:5173/');

  await page.click('#viewer-column-A-alignedto-load-btn');
  await page.setInputFiles('#viewer-column-A-alignedto-file-input', dataPath('4ug0.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });

  await page.setInputFiles('#viewer-column-B-aligned-file-input', dataPath('6xu8.cif'));
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });

  await page.click('#viewer-column-B-clipping-controls-toggle-btn');
  const clipRadiusInput = page.locator('#viewer-column-B-aligned-clip-far-number');
  await expect(clipRadiusInput).toBeVisible();

  const beforeMolstarInteraction = await clipRadiusInput.inputValue();

  const viewerB = page.locator('#viewer-column-B');
  await viewerB.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await viewerB.getByRole('button', { name: 'Reset Zoom' }).click();

  await expect(async () => {
    const afterMolstarInteraction = await clipRadiusInput.inputValue();
    expect(afterMolstarInteraction).not.toBe(beforeMolstarInteraction);
  }).toPass({ timeout: 20000 });
});
