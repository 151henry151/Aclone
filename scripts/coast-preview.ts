// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { coastPreviewHTML } from './coast-preview-scene';
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors: string[] = [];
  page.on('pageerror', (e) => (errors.push(e.message), console.error(e.message)));
  page.on('console', (m) => {
    if (m.type() === 'log') console.log(m.text());
    if (m.type() === 'error') {
      errors.push(m.text());
      console.error(m.text());
    }
  });
  await page.route('**/__coast', (r) =>
    r.fulfill({ contentType: 'text/html', body: coastPreviewHTML }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__coast');
  await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 120000 });
  mkdirSync('output/coast', { recursive: true });
  for (const mode of ['day', 'storm', 'night', 'distant', 'off', 'calm', 'beach']) {
    console.log(mode, await page.evaluate((mode) => (window as any).shot(mode, 2), mode));
    await page.screenshot({ path: 'output/coast/' + mode + '.png', timeout: 60000 });
  }
  for (let i = 0; i < 6; i++) {
    await page.evaluate((t) => (window as any).shot('storm', t), i);
    await page.screenshot({ path: 'output/coast/surf-' + i + '.png' });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
