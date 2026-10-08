/**
 * Playwright E2E test: Save/Load session with real datasets
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'path';

const inputDir = path.resolve(__dirname, '../data/input');
const alignedToFile = path.join(inputDir, '4ug0.cif');
const alignedFile = path.join(inputDir, '6xu8.cif');

async function completeRequiredFilesModal(page: Page) {
  await expect(page.getByText('Load Session: Select Required Files')).toBeVisible();
  const fileInputs = await page.$$('[data-testid^="session-load-modal-file-input-"]');

  for (const input of fileInputs) {
    const label = await input.evaluate((el: HTMLInputElement) => el.parentElement?.textContent || '');
    const normalizedLabel = label.toLowerCase();
    if (normalizedLabel.includes('4ug0.cif')) {
      await input.setInputFiles(alignedToFile);
    } else if (normalizedLabel.includes('6xu8.cif')) {
      await input.setInputFiles(alignedFile);
    }
  }

  await expect(page.getByTestId('session-load-modal-load-btn')).toBeEnabled();
  await page.getByTestId('session-load-modal-load-btn').click();
}

test.describe('Session Save/Load E2E', () => {
  test('can load, save, and reload session with real data', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    await page.click('#viewer-column-A-alignedto-load-btn');
    await page.setInputFiles('#viewer-column-A-alignedto-file-input', alignedToFile);
    await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 20000 });
    await page.setInputFiles('#viewer-column-B-aligned-file-input', alignedFile);
    await page.click('#viewer-column-B-aligned-load-btn');

    await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/i);
    await expect(page.locator('#viewer-column-B-aligned-load-btn')).toHaveCount(0, { timeout: 20000 });

    await page.click('#session-menu-btn');
    await page.click('#session-menu-dropdown .session-menu-item:text-is("Save")');

    await page.reload();
    await page.click('#session-menu-btn');
    await page.click('#session-menu-dropdown .session-menu-item:text-is("Load")');

    await page.setInputFiles('#session-menu-file-input', path.resolve(__dirname, 'test-session.json'));

    await completeRequiredFilesModal(page);

    await expect(page.locator('#viewer-column-A-molstar-container')).toBeVisible();
    await expect(page.locator('#viewer-column-B-molstar-container')).toBeVisible();
    await expect(page.locator('#viewer-column-A-alignedto-filename-label')).toHaveText(/4ug0\.cif/i);
    await expect(page.locator('#viewer-column-B-aligned-load-btn')).toHaveCount(0, { timeout: 20000 });
  });
});
