// SPDX-License-Identifier: GPL-3.0-or-later
// Actual countryside renderer captures in a disposable world; no live data or AI.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, terrainHeight } from '../src/shared/simulation.ts';
import { creatorSchema } from '../src/shared/creator.ts';
import { waitForWorld } from '../tests/browser/fixtures/ready.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-hills-'));
const app = await createApp({ dataDir: dir, port: 0, dev: true });
const { account, token } = app.universe.register('Countryside visitor');
const w = createWorld('puddlewick', 'Puddlewick', account.id);
w.creator = creatorSchema.parse({ weather: 'clear' });
w.settings.dayLength = 0;
w.settings.time = 28000;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.climate = { snow: 0, wetness: 0 };
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.x = -900;
p.z = -300;
p.y = terrainHeight(w, p.x, p.z);
p.heading = Math.PI / 2;
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'low');
    },
    { token, world: w.id },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await waitForWorld(page);
  mkdirSync('test-results/hills', { recursive: true });
  await page.keyboard.press('h');
  await expect(page.locator('#toast')).not.toHaveClass(/show/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/hills/foothills.png' });
  p.x = -1400;
  p.z = -1000;
  p.y = terrainHeight(w, p.x, p.z);
  p.heading = Math.PI * 1.5;
  p.speed = 0;
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/hills/rolling-countryside.png' });
  expect(errors).toEqual([]);
  console.log('Captured actual foothills and countryside terrain.');
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
