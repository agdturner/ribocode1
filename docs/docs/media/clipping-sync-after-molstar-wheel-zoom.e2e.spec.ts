/**
 * Playwright E2E test to ensure clipping controls stay in sync after Mol* wheel zoom operations.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-06-11
 */
import { test } from '@playwright/test';
import { expectClippingAfterNativeReset, nativeClippingLaunchOptions } from './helpers/native-clipping';

test.use({ launchOptions: nativeClippingLaunchOptions });

test('Clip Radius reflects Mol* selection-mode plus reset-zoom camera changes', async ({ page }) => {
  test.setTimeout(150000);
  await expectClippingAfterNativeReset(page, true);
});
