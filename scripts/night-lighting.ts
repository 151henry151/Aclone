// SPDX-License-Identifier: GPL-3.0-or-later
// Repeatable midnight views of the real game, using a disposable world and account.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { weatherAt } from '../src/shared/environment.ts';

const dir = mkdtempSync(join(tmpdir(), 'aclone-lighting-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/night-lighting';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Night driver');
const w = createWorld('lighting-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.time = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const day = Array.from({ length: 70 }, (_, i) => 60 + i).find(
  (d) => weatherAt(w.id, d).precipitation === 'clear',
)!;
w.time = (day - 59 - 42200 / 86400) * 600 + 1;
const p = addPlayer(w, account.id, account.name);
p.x = 100;
p.z = -190;
p.heading = Math.PI / 2;
p.lights = false;
app.worlds.set(w.id, w);
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: [
    '--no-sandbox',
    ...(process.env.SCREENSHOT_GPU === '1'
      ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ({ token, world, quality }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', quality);
    },
    { token, world: w.id, quality: process.env.SCREENSHOT_QUALITY ?? 'high' },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible();
  await page.keyboard.press('h');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(output, 'headlights-off.png') });
  await page.keyboard.press('l');
  await expect.poll(() => p.lights).toBe(true);
  await page.waitForTimeout(1500);
  await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: join(output, 'headlights-on.png') });
  await page.keyboard.press('c');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(output, 'headlights-driver.png') });
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.keyboard.press('l');
  await expect.poll(() => p.lights).toBe(false);
  p.x = 14;
  p.z = -118;
  p.heading = Math.PI;
  await page.waitForTimeout(3500);
  await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
  await page.screenshot({ path: join(output, 'streetlights.png') });
  w.settings.time = 43200;
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(output, 'daytime.png') });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`Night/day views and headlight toggle passed without browser errors: ${output}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
