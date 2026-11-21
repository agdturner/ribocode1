/**
 * Helper functions for loading sessions and required files in Playwright E2E tests.
 *
 * Provides utilities for resolving data paths, session fixture paths, waiting for session menu readiness,
 * and loading sessions with required files.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { expect, type Page } from '@playwright/test';
import path from 'path';

export function dataPath(filename: string) {
  return path.resolve(__dirname, '../../data/input', filename);
}

export function sessionFixturePath(sessionFixtureFile: string) {
  return path.resolve(__dirname, '..', sessionFixtureFile);
}

export async function waitForSessionMenuReady(page: Page) {
  await expect(page.locator('#session-menu-btn')).toBeVisible({ timeout: 45000 });
}

export async function loadSessionAndRequiredFiles(page: Page, sessionFixtureFile: string) {
  await waitForSessionMenuReady(page);
  await page.click('button#session-menu-btn');
  await page.waitForSelector('#session-menu-dropdown', { state: 'visible' });
  await page.waitForTimeout(200);
  await page.click('#session-menu-dropdown .session-menu-item:text-is("Load")');

  await page.setInputFiles('#session-menu-file-input', sessionFixturePath(sessionFixtureFile));

  await expect(page.getByText('Load Session: Select Required Files')).toBeVisible();
  await expect(page.getByText('4ug0.cif')).toBeVisible();
  await expect(page.getByText('6xu8.cif')).toBeVisible();

  const fileInputs = await page.$$('[data-testid^="session-load-modal-file-input-"]');
  for (const input of fileInputs) {
    const label = await input.evaluate((el: HTMLInputElement) => el.parentElement?.textContent || '');
    if (label.includes('4ug0.cif')) {
      await input.setInputFiles(dataPath('4ug0.cif'));
    } else if (label.includes('6xu8.cif')) {
      await input.setInputFiles(dataPath('6xu8.cif'));
    }
  }

  await expect(page.getByTestId('session-load-modal-load-btn')).toBeEnabled();
  await page.getByTestId('session-load-modal-load-btn').click();
}