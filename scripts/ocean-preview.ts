// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { oceanPreviewHTML } from './ocean-preview-scene';
const dir = 'output/ocean';
mkdirSync(dir, { recursive: true });
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
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors: string[] = [],
  metrics: unknown[] = [];
try {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/__ocean', (r) =>
    r.fulfill({ contentType: 'text/html', body: oceanPreviewHTML }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__ocean');
  await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 120000 });
  await page.evaluate(() => (window as any).prepareOcean());
  const started = Date.now();
  let index = 0;
  mkdirSync(dir + '/frames', { recursive: true });
  for (const [mode, seconds] of [
    ['clear', 3],
    ['storm', 9],
    ['cockpit', 5],
    ['shore', 4],
  ] as const) {
    for (let frame = 0; frame < seconds * 20; frame++) {
      const result = await page.evaluate(
        ([mode, time]) => {
          const result = (window as any).showOcean(mode, time);
          return { result, image: (window as any).game.renderer.domElement.toDataURL('image/png') };
        },
        [mode, frame / 20] as const,
      );
      const data = Buffer.from(result.image.split(',')[1], 'base64');
      writeFileSync(`${dir}/frames/${String(index++).padStart(4, '0')}.png`, data);
      if (frame === seconds * 20 - 1) {
        metrics.push({ mode, ...result.result });
        writeFileSync(`${dir}/${mode}-final.png`, data);
      }
    }
  }
  if (errors.length) throw Error(errors.join('\n'));
  writeFileSync(
    `${dir}/preview-metrics.json`,
    JSON.stringify({ elapsed: (Date.now() - started) / 1000, metrics }, null, 2),
  );
  await page.close();
  await context.close();
} finally {
  await browser.close();
  await server.close();
}
