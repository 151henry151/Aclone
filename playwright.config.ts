// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  // Concurrent software WebGL renderers starve input and snapshot handling on CI.
  workers: 1,
  timeout: process.env.TEST_GPU === '1' ? 120000 : 180000,
  use: {
    baseURL: process.env.TEST_URL ?? 'http://127.0.0.1:3000',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      args: [
        '--no-sandbox',
        '--enable-webgl',
        ...(process.env.TEST_GPU === '1'
          ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
          : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  reporter: 'list',
});
