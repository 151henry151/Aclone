// SPDX-License-Identifier: GPL-3.0-or-later
// Fresh marketing captures from a disposable game, using the actual renderer and editor.
// Run after npm run build; requires Chromium and ImageMagick's convert for WebP encoding.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation.ts';
import { weatherAt } from '../src/shared/environment.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-website-'));
const output = 'website/assets';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Village visitor');
const w = createWorld('website-parish', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const day = Array.from({ length: 80 }, (_, i) => 95 + i).find(
  (d) => weatherAt(w.id, d).precipitation === 'clear',
)!;
w.time = (day - 59 - 42200 / 86400) * 600;
w.settings.time = 48000;
w.climate = { snow: 0, wetness: 0 };
const p = addPlayer(w, account.id, account.name);
p.lights = false;
const farm = w.buildings.find((b) => b.kind === 'farm')!;
farm.plots = ['wheat', 'hay', 'potatoes', 'wheat'].map((crop) => ({
  crop,
  planted: w.time - 1500,
  ready: w.time + 400,
  water: 1,
  fertilized: true,
}));
w.buildings.push(makeBuilding('shore-pump', 'waterworks', 95, 132));
app.worlds.set(w.id, w);
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'high');
    },
    { token, world: w.id },
  );
  const position = (kind: string, dx: number, dz: number) => {
    const b = w.buildings.find((b) => b.kind === kind)!;
    p.x = b.x + dx;
    p.z = b.z + dz;
    p.heading = Math.atan2(-dx, -dz);
  };
  position('mill', 13, 24);
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('h');
  async function shot(name: string) {
    if (process.env.SCREENSHOT_NAMES && !process.env.SCREENSHOT_NAMES.split(',').includes(name))
      return;
    await page.waitForTimeout(2400);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0', { timeout: 15000 });
    const png = join(dir, name + '.png');
    // Hide only the scenery-mode helper while photographing the unmodified game renderer.
    await page.screenshot({ path: png, style: '#toast { visibility: hidden !important; }' });
    execFileSync('convert', [png, '-quality', '84', join(output, name + '.webp')]);
    console.log(name);
  }
  await shot('village');
  position('farm', 13, 32);
  await shot('farming');
  position('waterworks', 0, 12);
  await shot('waterworks');
  position('starport', 85, 320);
  p.heading = Math.atan2(23, -290);
  const vehicle = p.vehicle;
  p.vehicle = 5;
  await page.keyboard.press('c');
  await page.mouse.move(800, 500);
  await page.mouse.down();
  await page.mouse.move(800, 430, { steps: 6 });
  await page.mouse.up();
  await shot('spaceport');
  p.vehicle = vehicle;
  await page.mouse.move(800, 430);
  await page.mouse.down();
  await page.mouse.move(800, 500, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  position('mill', 13, 24);
  w.settings.time = 69000;
  p.lights = true;
  await shot('evening');
  w.settings.time = 48000;
  p.lights = false;
  await page.keyboard.press('h');
  await page.keyboard.press('F10');
  await expect(page.getByRole('dialog')).toBeVisible();
  await shot('creator');
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
