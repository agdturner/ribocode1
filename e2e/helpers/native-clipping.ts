import { expect, type Page } from '@playwright/test';
import path from 'path';

export const nativeClippingLaunchOptions = {
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
};

async function viewerClipRadius(page: Page) {
  return page.evaluate(() => {
    const camera = (window as Window & {
      __ribocodeTestApi?: {
        getRawCameraSnapshots: () => { viewerB?: { radius: number; radiusMax: number } };
      };
    }).__ribocodeTestApi?.getRawCameraSnapshots().viewerB;
    return camera && camera.radiusMax > 0
      ? 100 - Math.round(100 * camera.radius / camera.radiusMax)
      : null;
  });
}

export async function expectClippingAfterNativeReset(page: Page, toggleSelectionMode: boolean) {
  await page.goto('/');
  await page.locator('#viewer-column-A-alignedto-file-input')
    .setInputFiles(path.resolve(__dirname, '../../data/input/4ug0.cif'));
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 30000 });
  await page.locator('#viewer-column-B-aligned-file-input')
    .setInputFiles(path.resolve(__dirname, '../../data/input/6xu8.cif'));
  await expect(page.locator('#viewer-column-B-toggle-visibility-btn').nth(1)).toBeVisible({ timeout: 60000 });

  const viewer = page.locator('#viewer-column-B');
  await viewer.locator('#viewer-column-B-clipping-controls-toggle-btn').click();
  const clipRadius = viewer.locator('#viewer-column-B-aligned-clip-far-number');
  await expect(clipRadius).toBeVisible();
  // The load controls can be visible before Mol* has committed the scene and fitted the camera.
  await expect.poll(async () => (await viewerClipRadius(page)) ?? 100, { timeout: 30000 }).toBeLessThan(60);
  const clipped = 60;
  await clipRadius.fill(String(clipped));
  await expect.poll(() => viewerClipRadius(page), { timeout: 20000 }).toBe(clipped);
  await expect(clipRadius).toHaveValue(String(clipped));

  if (toggleSelectionMode) await viewer.getByRole('button', { name: 'Toggle Selection Mode' }).click();
  await viewer.getByRole('button', { name: 'Reset Zoom', exact: true }).click();

  await expect.poll(() => viewerClipRadius(page), { timeout: 20000 }).not.toBe(clipped);
  await expect(async () => {
    const effective = await viewerClipRadius(page);
    expect(effective).not.toBeNull();
    expect(effective).not.toBe(clipped);
    expect(await clipRadius.inputValue()).toBe(String(effective));
  }).toPass({ timeout: 20000 });
}
