import { test } from '@playwright/test';
import { expectClippingAfterNativeReset, nativeClippingLaunchOptions } from './helpers/native-clipping';

test.use({ launchOptions: nativeClippingLaunchOptions });

test('Clip Radius reflects Mol* Reset Zoom camera changes', async ({ page }) => {
  test.setTimeout(90000);
  await expectClippingAfterNativeReset(page, false);
});
