/**
 * Playwright configuration for E2E tests.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-10-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { defineConfig, devices } from '@playwright/test';

const reuseExistingServer = process.env.PW_E2E_REUSE_SERVER === '1';
const forceWebGL = process.env.PW_E2E_FORCE_WEBGL === '1';
const webglLaunchArgs = [
  '--enable-webgl',
  '--ignore-gpu-blocklist',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];

// See https://playwright.dev/docs/test-configuration for more details.
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: !forceWebGL,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : (forceWebGL ? 1 : undefined),
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    baseURL: 'http://localhost:5173',
    launchOptions: forceWebGL
      ? {
          args: webglLaunchArgs,
        }
      : undefined,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    // Default to strict startup; optionally reuse an already-running dev server for convenience.
    reuseExistingServer,
    timeout: 120 * 1000,
  },
});
