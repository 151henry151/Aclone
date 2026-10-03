// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated acceptance run: real UI actions, offline provisions, and staged visual comparisons.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding, advance } from '../src/shared/simulation.ts';
import { weatherAt } from '../src/shared/environment.ts';
import { resourceNodes } from '../src/shared/resources.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-living-'));
const app = await createApp({ dataDir: dir, port: 0 });
const { account, token } = app.universe.register('Village visitor');
const w = createWorld('living-review', 'Willow parish', account.id);
w.settings.dayLength = 0;
w.settings.hungerRate = w.settings.thirstRate = 0;
w.script = '';
const p = addPlayer(w, account.id, account.name);
p.cash = 100000;
p.inventory = { bread: 10, water: 10, tools: 1 };
p.tractorPaint = 'moss';
p.x = -59;
p.z = 44;
p.heading = -2.9;
const inn = makeBuilding('willow-inn', 'bnb', -63, 34);
inn.owner = 'keeper';
inn.lodging = { open: true, rate: 600, guests: {} };
w.buildings.push(inn, makeBuilding('country-hotel', 'hotel', -65, 4));
const resident = addPlayer(w, 'resident', 'Resident'),
  cottage = w.buildings.find((b) => b.kind === 'home')!;
cottage.style = 'white-clapboard';
cottage.owner = resident.id;
resident.home = cottage.id;
resident.atHome = true;
resident.online = false;
w.time = (90 + 365 - 59 - 42200 / 86400) * 600 + 1;
w.settings.time = 43000;
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
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('3 guest rooms');
  await page.getByLabel('Real hours').fill('2');
  await page.getByRole('button', { name: 'Book a room', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter your room' })).toBeVisible();
  await page.locator('select[name="item"]').last().selectOption('bread');
  await page.getByLabel('Quantity', { exact: true }).last().fill('5');
  await page.getByRole('button', { name: 'Transfer provisions' }).click();
  await expect.poll(() => inn.lodging?.guests[p.id]?.stock.bread).toBe(5);
  await expect(page.getByRole('dialog')).toContainText('Bread × 5');
  mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/lodging.png' });
  await page.getByRole('button', { name: 'Enter your room' }).click();
  await expect.poll(() => p.atHome).toBe(true);
  await page.reload();
  await expect(page.locator('#target')).toContainText('At home');
  p.online = false;
  p.hunger = 40000;
  advance(w, 60);
  if (inn.lodging!.guests[p.id].stock.bread >= 5) throw Error('Offline guest did not eat');
  p.online = true;
  await page.getByRole('button', { name: 'At home · Go outside' }).click();
  await expect.poll(() => p.atHome).toBe(false);
  // A second resident stays in the B&B while the visitor tours the village.
  const g = addPlayer(w, 'guest', 'Offline guest');
  g.atHome = true;
  g.home = inn.id;
  inn.lodging!.guests[g.id] = { until: w.time + 86400, stock: {} };
  await page.keyboard.press('h');
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'docs/screenshots/guesthouse.png' });
  w.settings.time = 68500;
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'docs/screenshots/evening-inn.png' });
  w.settings.time = 72000;
  p.x = -4;
  p.z = 15;
  p.heading = Math.PI;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/night-town.png' });
  p.x = 98;
  p.z = -97;
  p.heading = Math.PI;
  w.settings.time = 0;
  p.lights = false;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/dark-countryside.png' });
  p.lights = true;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/headlights.png' });
  const day = Array.from({ length: 50 }, (_, i) => i).find(
    (d) => weatherAt(w.id, d + 365).precipitation === 'snow' && weatherAt(w.id, d + 365).storm,
  )!;
  w.time = (day + 365 - 59 - 42200 / 86400) * 600 + 1;
  w.settings.time = 43000;
  w.climate = { snow: 0.8, wetness: 0 };
  p.x = -4;
  p.z = 15;
  p.heading = Math.PI;
  p.lights = false;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/snowstorm.png' });
  w.time = (90 + 365 - 59 - 42200 / 86400) * 600 + 1;
  w.settings.time = 43000;
  w.climate = { snow: 0, wetness: 0 };
  const node = resourceNodes.find((n) => n.item === 'dirt')!;
  p.x = node.x;
  p.z = node.z;
  p.y = 0.15;
  await page.keyboard.press('h');
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  await page.getByRole('button', { name: 'Gather', exact: true }).first().click();
  await expect.poll(() => p.task?.kind).toBe('gather');
  advance(w, 21);
  await expect.poll(() => p.inventory.dirt).toBe(3);
  await page.getByRole('button', { name: 'Resources', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/gathering.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.keyboard.press('h');
  p.x = -106;
  p.z = -72;
  p.heading = Math.PI;
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'docs/screenshots/woodland.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: room booking, private provisions, re-entry, offline feeding, gathering and living-world captures; no browser errors.',
  );
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
