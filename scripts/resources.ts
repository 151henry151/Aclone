// SPDX-License-Identifier: GPL-3.0-or-later
// Inspect actual gathering grounds in a disposable running game; never production.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, terrainHeight } from '../src/shared/simulation.ts';
import { resourceNodes } from '../src/shared/resources.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-resources-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/resources';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true });
const { account, token } = app.universe.register('Countryside inspector');
const w = createWorld('resource-review', 'Puddlewick', account.id);
w.settings.dayLength = 0;
w.settings.time = 43200;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
w.time = 90 * 600;
w.climate = { snow: 0, wetness: 0 };
const p = addPlayer(w, account.id, account.name);
p.vehicle = 5;
p.lights = false;
p.inventory = { chainsaw: 1, pickaxe: 1, shovel: 1 };
app.worlds.set(w.id, w);
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'high');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  await page.goto(`http://127.0.0.1:${port}`);
  await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
  await page.keyboard.press('h');
  for (const item of ['logs', 'stone', 'gravel', 'dirt']) {
    const node = resourceNodes.find((n) => n.item === item)!;
    p.x = node.x + 5;
    p.z = node.z + 13;
    p.heading = Math.atan2(-5, -13);
    p.y = terrainHeight(w, p.x, p.z);
    await page.waitForTimeout(2300);
    await page.screenshot({ path: join(output, `${item}.png`) });
  }
  const node = resourceNodes.find((n) => n.item === 'gravel')!;
  p.x = node.x;
  p.z = node.z + 6;
  p.y = terrainHeight(w, p.x, p.z);
  p.heading = Math.PI;
  await page.keyboard.press('h');
  await page.waitForTimeout(1500);
  const gather = page.locator('#resource-gather');
  await expect(gather).toBeVisible();
  await gather.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#task-control')).toBeVisible();
  await page.screenshot({ path: join(output, 'gravel-gathering.png') });
  await expect.poll(() => p.inventory.gravel ?? 0, { timeout: 30000 }).toBe(3);
  console.log('Resource screenshots:', output, 'Errors:', errors);
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
