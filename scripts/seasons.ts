// SPDX-License-Identifier: GPL-3.0-or-later
// Reproducible staged gameplay views on an isolated, disposable local server.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, advance } from '../src/shared/simulation.ts';
import { weatherAt } from '../src/shared/environment.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-seasons-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'docs/screenshots';
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Seasonal farmer');
const w = createWorld('seasonal-review', 'Willow parish', account.id);
w.settings.dayLength = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.tractorPaint = 'blue';

p.heading = -2.55;
p.skills = ['farmer'];
p.cash = 300000;
const cottage = w.buildings.find((b) => b.kind === 'home')!;
cottage.style = 'red-timber';
p.x = cottage.x + 6;
p.z = cottage.z + 9;
const resident = addPlayer(w, 'resident', 'At home');
resident.home = cottage.id;
resident.atHome = resident.online = true;
cottage.owner = resident.id;
const farm = w.buildings.find((b) => b.kind === 'farm')!;
farm.owner = p.id;
farm.investment = 10000;
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
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'high');
    },
    { token, world: w.id },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('h');
  await page.mouse.wheel(0, -450);
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  mkdirSync(output, { recursive: true });
  const winter = Array.from({ length: 50 }, (_, i) => i).find(
    (d) => weatherAt(w.id, d + 365).precipitation === 'snow',
  )!;
  for (const [name, day, clock] of [
    ['sunset', 190, 70000],
    ['winter', winter, 43000],
    ['wood-cottage', 90, 43000],
  ] as const) {
    w.time = (day + 365 - 59 - 42200 / 86400) * 600 + 1;
    w.settings.time = clock;
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  p.x = farm.x + 12;
  p.z = farm.z + 33;
  p.heading = Math.PI;
  w.time = (180 + 365 - 59 - 42200 / 86400) * 600 + 1;
  w.settings.time = 45000;
  farm.plots = Array.from({ length: 4 }, (_, i) => ({
    crop: ['wheat', 'hops', 'potatoes', 'grapes'][i],
    planted: w.time - 6000,
    ready: w.time + (i === 0 ? -1 : 3000 * (i + 1)),
    water: 2,
    fertilized: true,
  }));
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: join(output, 'farm-plots.png') });
  await page.keyboard.press('h');
  p.x = farm.x;
  p.z = farm.z + 13;
  await page.waitForTimeout(600);
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('Four plots');
  await page.screenshot({ path: join(output, 'farming.png') });
  await page.getByRole('button', { name: 'Harvest', exact: true }).first().click();
  await expect.poll(() => p.task?.kind).toBe('harvest');
  advance(w, 15);
  await expect.poll(() => farm.stock.wheat).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const starport = w.buildings.find((b) => b.kind === 'starport')!;
  p.x = starport.x;
  p.z = starport.z + 13;
  await page.waitForTimeout(600);
  await page.keyboard.press('e');
  await page.getByRole('button', { name: 'Take off to space' }).click();
  await expect(page.getByRole('img', { name: /Galaxy map/ })).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  await page.screenshot({ path: join(output, 'galaxy-routes.png') });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved seasonal, cottage, farming and galaxy captures without browser errors.');
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
