// SPDX-License-Identifier: GPL-3.0-or-later
// In-game evergreen inspection on a disposable server; no production or saved-world edits.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, terrainHeight } from '../src/shared/simulation.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-evergreens-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/evergreens';
const quality = process.env.SCREENSHOT_QUALITY ?? 'high';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true });
const { account, token } = app.universe.register('Woodland walker');
const w = createWorld('woodland-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.time = 43200;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.vehicle = 5;
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
  page.setDefaultTimeout(60000);
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
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id, quality },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  // Inspect the actual countryside generator to locate existing trees; render the game normally.
  const sites = await page.evaluate(
    async ({ world, low }) => {
      const sceneryPath = '/src/client/scenery.ts',
        threePath = '/node_modules/.vite/deps/three.js';
      const { countryside } = await import(sceneryPath);
      const T = await import(threePath);
      const root = new T.Group();
      countryside(root, world, low);
      const sites: { x: number; z: number; scale: number }[] = [];
      root.traverse((mesh: any) => {
        if (
          !mesh.isInstancedMesh ||
          !(mesh.geometry.type === 'ConeGeometry' || mesh.name.startsWith('Evergreen wood'))
        )
          return;
        const m = new T.Matrix4(),
          at = new T.Vector3(),
          scale = new T.Vector3(),
          q = new T.Quaternion();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m);
          m.decompose(at, q, scale);
          if (!sites.some((s) => Math.hypot(s.x - at.x, s.z - at.z) < 0.1))
            sites.push({ x: at.x, z: at.z, scale: scale.y });
        }
      });
      return sites;
    },
    { world: w, low: quality === 'low' },
  );
  // Same grove and tree in both quality modes, away from buildings and the shore.
  const site = sites.sort(
    (a, b) =>
      Math.hypot(a.x + 205.72058, a.z + 213.43216) - Math.hypot(b.x + 205.72058, b.z + 213.43216),
  )[0];
  if (!site) throw Error('No evergreen sites');
  console.log('Evergreen site', site);
  await page.keyboard.press('h');
  await page.keyboard.press('c');
  let pitch = 0;
  for (const [name, dx, dz, nextPitch] of [
    ['evergreen', 9, 20, 0.18],
    ['evergreen-close', 4, 7, 0.32],
    ['evergreen-side', -15, 9, 0.22],
    ['evergreen-grove', 15, 35, 0.12],
  ] as const) {
    p.x = site.x + dx;
    p.z = site.z + dz;
    p.y = terrainHeight(w, p.x, p.z);
    p.heading = Math.atan2(-dx, -dz);
    await page.mouse.move(720, 600);
    await page.mouse.down();
    await page.mouse.move(720, 600 - (nextPitch - pitch) / 0.004, { steps: 8 });
    await page.mouse.up();
    pitch = nextPitch;
    await page.waitForTimeout(1800);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  p.x = site.x + 9;
  p.z = site.z + 20;
  p.y = terrainHeight(w, p.x, p.z);
  p.heading = Math.atan2(-9, -20);
  await page.mouse.move(720, 600);
  await page.mouse.down();
  await page.mouse.move(720, 600 - (0.18 - pitch) / 0.004, { steps: 8 });
  await page.mouse.up();
  // Snowfall uses the same live seasonal materials as normal gameplay.
  w.time = (365 - 59 - 42200 / 86400) * 600;
  w.climate = { snow: 0.85, wetness: 0 };
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(output, 'evergreen-winter.png') });
  console.log(
    'Renderer statistics',
    await page.locator('#viewport canvas').evaluate((el) => ({
      triangles: el.getAttribute('data-triangles'),
      calls: el.getAttribute('data-draw-calls'),
    })),
  );
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Evergreen views rendered without browser errors:', output);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
