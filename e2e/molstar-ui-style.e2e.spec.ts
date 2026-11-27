/**
 * Browser coverage for Mol* viewport styling and advanced controls.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 */
import { expect, test } from '@playwright/test';
import { nativeClippingLaunchOptions } from './helpers/native-clipping';

test.use({ launchOptions: nativeClippingLaunchOptions });

for (const width of [1280, 900]) {
  test(`Mol* controls remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');

    for (const column of ['A', 'B']) {
      const viewer = page.locator(`#viewer-column-${column}`);
      const viewport = viewer.locator('.msp-viewport');
      const controls = viewer.locator('.molstar-container-root .msp-viewport-controls');
      await expect(viewport).toBeVisible();
      await expect(controls).toBeVisible();
      await expect(viewer.getByRole('button', { name: 'Toggle Controls Panel' })).toHaveCount(0);

      const positions = await controls.locator('button[title]').evaluateAll(buttons =>
        buttons.filter(button => ['Settings / Controls Info', 'Illumination', 'Augmented/Virtual Reality unavailable'].includes(button.getAttribute('title') ?? ''))
          .map(button => {
            const rect = button.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width };
          })
      );
      expect(positions).toHaveLength(3);
      expect(positions.every(position => Math.abs(position.x - positions[0].x) < 1)).toBe(true);
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
      expect(positions[2].y).toBeGreaterThan(positions[1].y);
      expect(positions[0].width).toBeCloseTo(32, 0);

      const settings = controls.locator('button[title="Settings / Controls Info"]');
      await settings.click();
      await expect(controls.locator('.msp-viewport-controls-panel')).toBeVisible();
      await settings.click();
      await expect(controls.locator('.msp-viewport-controls-panel')).toHaveCount(0);

      await viewer.getByRole('button', { name: 'Toggle Selection Mode' }).click();
      const selection = viewer.locator('.msp-selection-viewport-controls');
      await expect(selection).toBeVisible();
      const bounds = await selection.evaluate(element => {
        const toolbar = element.getBoundingClientRect();
        const canvas = element.parentElement!.querySelector('.msp-viewport')!.getBoundingClientRect();
        const buttons = element.parentElement!.querySelector('.msp-viewport-controls')!.getBoundingClientRect();
        return { top: toolbar.top, canvasTop: canvas.top, canvasBottom: canvas.bottom, right: toolbar.right, controlsLeft: buttons.left };
      });
      expect(bounds.top).toBeGreaterThanOrEqual(bounds.canvasTop);
      expect(bounds.top).toBeLessThan(bounds.canvasBottom);
      expect(bounds.right).toBeLessThanOrEqual(bounds.controlsLeft);

      const icons = selection.locator('button').filter({ has: page.locator('.msp-shape-empty') });
      await expect(icons).toHaveCount(4);
      await expect(icons.first().locator('.msp-shape-empty').first()).toHaveCSS('fill', 'none');
      await expect(icons.first().locator('.msp-shape-empty').first()).not.toHaveCSS('stroke', 'none');
      await expect(selection.locator('.msp-shape-filled').first()).not.toHaveCSS('fill', 'none');
      await viewer.getByRole('button', { name: 'Turn selection mode off' }).click();
      await expect(selection).toHaveCount(0);

      const panel = viewer.getByTestId(`viewer-column-${column}-advanced-molstar-controls-panel`);
      await expect(panel).toHaveCount(0);
      await viewer.getByRole('button', { name: 'Show Advanced Mol* Controls' }).click();
      await expect(panel.getByRole('heading', { name: 'Sequence', exact: true })).toBeVisible();
      await expect(panel.locator('.msp-sequence')).toBeVisible();
      const sequenceBounds = await panel.evaluate(element => {
        const heading = element.querySelector('.molstar-advanced-controls-title')!.getBoundingClientRect();
        const sequence = element.querySelector('.msp-sequence')!.getBoundingClientRect();
        return { headingBottom: heading.bottom, sequenceTop: sequence.top, sequenceHeight: sequence.height };
      });
      expect(sequenceBounds.sequenceTop).toBeGreaterThanOrEqual(sequenceBounds.headingBottom);
      expect(sequenceBounds.sequenceHeight).toBe(160);
      await viewer.getByRole('button', { name: 'Hide Advanced Mol* Controls' }).click();
      await expect(panel).toHaveCount(0);
    }
  });
}
