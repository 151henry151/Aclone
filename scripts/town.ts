// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the actual renderer and validate the expanded parish on a disposable server.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { weatherAt } from '../src/shared/environment.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-town-'));
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Town visitor');
const w = createWorld('town-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.time = 43200;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.x = 0;
p.z = 17;
p.heading = Math.PI;
// Choose a clear spring day, keeping the normal daylight/terrain/rendering systems.
const day = Array.from({ length: 70 }, (_, i) => 60 + i).find(
  (d) => weatherAt(w.id, d).precipitation === 'clear',
)!;
w.time = (day - 59 - 42200 / 86400) * 600;
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
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
  mkdirSync('docs/screenshots', { recursive: true });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/screenshots/sprawling-town.png' });
  await page.keyboard.press('c');
  await page.keyboard.press('c');
  await page.mouse.move(800, 400);
  await page.mouse.wheel(0, 1800);
  p.x = -30;
  p.z = -40;
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/screenshots/town-overview.png' });
  // Every public service can be approached and opened using normal UI controls.
  for (const kind of ['market', 'workhouse', 'garage', 'school', 'starport']) {
    const b = w.buildings.find((b) => b.kind === kind)!;
    p.x = b.x;
    p.z = b.z + 13;
    p.speed = 0;
    await expect(page.locator('#target')).toContainText(b.name);
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog')).toContainText(b.name);
    await page.keyboard.press('Escape');
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Expanded town rendered; every public service approached and opened.');
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
