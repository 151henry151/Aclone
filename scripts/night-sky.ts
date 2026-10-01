// SPDX-License-Identifier: GPL-3.0-or-later
// Real-renderer night-sky acceptance views on a disposable server.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer } from '../src/shared/simulation.ts';
import { weatherAt, sunAt } from '../src/shared/environment.ts';
import { celestialAt } from '../src/shared/astronomy.ts';
import { cloudOpacity } from '../src/client/sky-weather.ts';

const dir = mkdtempSync(join(tmpdir(), 'aclone-sky-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/night-sky';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Night driver');
const w = createWorld('sky-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.time = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.x = 220;
p.z = -210;
p.vehicle = 5;
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
  await page.keyboard.press('c');
  let pitch = 0;
  const sample = (minPhase: number, maxPhase: number, overcast = false, moonless = false) => {
    for (let day = 60; day < 790; day++)
      for (const hour of [20, 21, 22, 23, 0, 1, 2, 3, 4]) {
        const seconds = hour * 3600,
          sky = celestialAt(day, seconds),
          m = sky.moons[0];
        const weather = weatherAt(w.id, day);
        const time = (day + seconds / 86400 - 59 - 42200 / 86400) * 600 + 0.5;
        const cover = cloudOpacity(m.direction, weather.clouds, time * 0.001 * weather.wind);
        if (
          sunAt(seconds, day).direction[1] > -0.18 ||
          (moonless
            ? sky.moons.some((moon) => moon.direction[1] > -0.1)
            : m.direction[1] < 0.18 || m.direction[1] > 0.6)
        )
          continue;
        if (m.illuminated < minPhase || m.illuminated > maxPhase) continue;
        if (
          overcast
            ? weather.precipitation === 'clear' || cover < 0.98
            : weather.precipitation !== 'clear' || cover > 0.12
        )
          continue;
        return { day, seconds, sky, time, cover };
      }
    throw Error('No matching natural sky found');
  };
  let groundHeading = 0;
  const capture = async (name: string, at: ReturnType<typeof sample>, ground = false) => {
    w.time = at.time;
    w.settings.time = at.seconds;
    const m = at.sky.moons[0];
    p.heading = ground ? groundHeading : Math.atan2(m.direction[0], m.direction[2]);
    const nextPitch = ground ? -0.14 : Math.max(0, Math.asin(m.direction[1]) - 0.16);
    await page.mouse.move(720, 600);
    await page.mouse.down();
    await page.mouse.move(720, 600 - (nextPitch - pitch) / 0.004, { steps: 8 });
    await page.mouse.up();
    pitch = nextPitch;
    await page.waitForTimeout(3000);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    if (errors.length) throw Error(errors.join('\n'));
    await page.screenshot({ path: join(output, name + '.png') });
    console.log(name, {
      day: at.day,
      hour: at.seconds / 3600,
      phase: m.illuminated,
      cover: at.cover,
    });
  };
  const full = sample(0.97, 1);
  await capture('full-moons', full);
  // Keep the same camera: the sky advances while the observer stays put.
  w.settings.time = (full.seconds + 7200) % 86400;
  w.time += (600 * 2) / 24;
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(output, 'two-hours-later.png') });
  await capture('half-moons', sample(0.45, 0.55));
  await capture('crescent-moons', sample(0.07, 0.22));
  await capture('overcast', sample(0.8, 1, true));
  // Hold the ground view fixed to compare visibility without vehicle/street lights.
  groundHeading = Math.atan2(full.sky.moons[0].direction[0], full.sky.moons[0].direction[2]);
  await capture('full-moon-ground', full, true);
  await capture('starlight-ground', sample(0, 1, false, true), true);
  await capture('overcast-ground', sample(0.8, 1, true), true);
  w.settings.time = 43200;
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(output, 'daytime.png') });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    `Lunar phases, sky motion, clouds and daytime rendered without browser errors: ${output}`,
  );
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
