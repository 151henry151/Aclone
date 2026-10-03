// SPDX-License-Identifier: GPL-3.0-or-later
// Repeatable sunrise/sunset/night views of the real renderer, without production data.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { sunAt, weatherAt } from '../src/shared/environment.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-twilight-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/twilight';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Horizon observer');
const w = createWorld('twilight-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.vehicle = 5;
p.lights = false;
p.x = 210;
p.z = -210;
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'low');
    },
    { token, world: w.id },
  );
  const day = Array.from({ length: 90 }, (_, i) => 80 + i).find(
    (d) => weatherAt(w.id, d).precipitation === 'clear',
  )!;
  const timeFor = (afternoon: boolean, height: number) =>
    Array.from({ length: 720 }, (_, i) => (i + (afternoon ? 720 : 0)) * 60).reduce(
      (best, t) =>
        Math.abs(sunAt(t, day).direction[1] - height) <
        Math.abs(sunAt(best, day).direction[1] - height)
          ? t
          : best,
      afternoon ? 64800 : 21600,
    );
  const set = (seconds: number) => {
    w.time = (day + seconds / 86400 - 59 - 42200 / 86400) * 600;
    w.settings.time = seconds;
    const d = sunAt(seconds, day).direction;
    p.heading = Math.atan2(d[0], d[2]);
  };
  set(timeFor(false, 0.045));
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('h');
  await page.keyboard.press('c');
  await page.mouse.move(640, 500);
  await page.mouse.down();
  await page.mouse.move(640, 430, { steps: 6 });
  await page.mouse.up();
  for (const [name, seconds] of [
    ['sunrise', timeFor(false, 0.045)],
    ['sunset', timeFor(true, 0.025)],
    ['afterglow', timeFor(true, -0.065)],
    ['midnight', 0],
    ['noon', 43200],
  ] as const) {
    set(seconds);
    await page.waitForTimeout(2500);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0', { timeout: 15000 });
    await page.screenshot({ path: join(output, name + '.png') });
    console.log(name, { day, seconds, height: sunAt(seconds, day).direction[1] });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
