// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import config from '../playwright.config.js';

const browser = await chromium.launch(config.use?.launchOptions);
try {
  const page = await browser.newPage();
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return info ? String(gl!.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  });
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/gpu-renderer.json', JSON.stringify({ renderer }, null, 2) + '\n');
  console.log(`Chromium WebGL renderer: ${renderer || 'unavailable'}`);
  if (!renderer || /swiftshader|llvmpipe|softpipe|software|lavapipe/i.test(renderer)) {
    throw new Error('GPU CI requires hardware WebGL; software fallback is not accepted.');
  }
} finally {
  await browser.close();
}
