// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation';
import { terrainHeight } from '../src/shared/terrain';
const dir = mkdtempSync(join(tmpdir(), 'aclone-haulage-')),
  output = 'output/backlog-walkthrough';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true });
const { account, token } = app.universe.register('Haulage reviewer');
const w = createWorld('haulage-review', 'Haulage review', account.id);
w.script = '';
w.settings.dayLength = 0;
w.settings.time = 43200;
w.settings.vehicleLicences = false;
w.buildings = [];
w.roads = [];
const p = addPlayer(w, account.id, account.name);
Object.assign(p, {
  x: 0,
  z: 0,
  y: terrainHeight(w, 0, 0),
  heading: 0,
  cash: 5000000,
  inventory: { hay: 20 },
  fuel: 64,
  fuelVehicle: 0,
  fleet: [0, 5, 30, 32, 33],
  engine: true,
});
const garage = makeBuilding('review-garage', 'garage', 14, 0);
garage.name = 'Haulage garage';
w.buildings.push(garage);
app.worlds.set(w.id, w);
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
});
try {
  const page = await context.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  await page.waitForTimeout(1500);
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog')).toContainText('Specialist trailers');
  const buy = page
    .locator('form[data-action="trailer"]')
    .filter({ has: page.locator('input[name="kind"][value="hay"]') });
  await buy.getByRole('button').click();
  await expect.poll(() => Object.values(w.trailers ?? {}).length).toBe(1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  const load = page
    .locator('form[data-action="trailer"]')
    .filter({ has: page.locator('input[name="operation"][value="load"]') });
  await load.locator('[name="item"]').selectOption('hay');
  await load.locator('[name="quantity"]').fill('20');
  await load.getByRole('button').click();
  await page.waitForTimeout(1500);
  await expect.poll(() => Object.values(w.trailers!)[0].cargo.hay).toBe(20);
  await page.screenshot({ path: output + '/cargo.png' });
  await page.keyboard.press('Escape');
  await page.locator('#viewport canvas').click({ position: { x: 800, y: 400 } });
  const start = { x: p.x, z: p.z };
  await page.keyboard.down('w');
  await page.waitForTimeout(2200);
  await page.keyboard.down('a');
  await page.waitForTimeout(1500);
  await page.keyboard.up('a');
  await page.waitForTimeout(1800);
  await page.keyboard.up('w');
  await page.waitForTimeout(1200);
  await expect.poll(() => Math.hypot(p.x - start.x, p.z - start.z)).toBeGreaterThan(3);
  await page.keyboard.press('h');
  await page.screenshot({ path: output + '/trailer-driving.png' });
  await page.keyboard.press('h');
  await page.keyboard.press('i');
  await page
    .locator('form[data-action="trailer"]')
    .filter({ has: page.locator('input[name="operation"][value="unhitch"]') })
    .getByRole('button')
    .click();
  await expect.poll(() => Object.values(w.trailers!)[0].attached).toBeUndefined();
  await page.keyboard.press('Escape');
  // A second local fixture checks the actual boat renderer, including rowed fallback and night lamps.
  Object.assign(p, {
    vehicle: 33,
    x: 0,
    z: 1000,
    y: 0,
    heading: 0,
    speed: 0,
    inventory: {},
    fuel: 0,
    fuelVehicle: 33,
    engine: false,
  });
  w.settings.mapSize = 5000;
  w.revision++;
  await page.waitForTimeout(2000);
  await page.locator('#viewport canvas').click({ position: { x: 800, y: 400 } });
  const rowStart = p.z;
  await page.keyboard.down('w');
  await page.waitForTimeout(2000);
  await page.keyboard.up('w');
  await page.waitForTimeout(1000);
  await expect.poll(() => Math.abs(p.z - rowStart)).toBeGreaterThan(0.5);
  await page.keyboard.press('h');
  await page.screenshot({ path: output + '/motorboat-rowing.png' });
  await page.keyboard.press('h');
  Object.assign(p, {
    vehicle: 32,
    x: 0,
    z: 1000,
    speed: 0,
    fuel: 512,
    fuelVehicle: 32,
    engine: true,
  });
  w.revision++;
  await page.waitForTimeout(2000);
  await page.keyboard.press('c');
  await page.waitForTimeout(1000);
  await page.keyboard.press('h');
  await page.screenshot({ path: output + '/tug-cockpit.png' });
  await page.keyboard.press('h');
  // Exercise the rescue controls through the same forms players use.
  Object.assign(p, {
    vehicle: 33,
    x: 5.5,
    z: 1000,
    heading: 0,
    speed: 0,
    fuel: 12,
    fuelVehicle: 33,
    parkedFuel: { 30: 0 },
    inventory: { fuel: 2 },
  });
  w.boatRescues = {
    [p.id]: {
      boat: { x: 0, z: 1000, heading: 0, slot: 30, paint: 'blue' },
      cargo: { cod: 10 },
      dinghy: { x: 0, z: 200, heading: 0, moored: true },
    },
  };
  w.revision++;
  await page.waitForTimeout(1200);
  await page.keyboard.press('i');
  await page.getByRole('button', { name: 'Reboard your stranded boat' }).click();
  await expect.poll(() => p.vehicle).toBe(30);
  await page.keyboard.press('Escape');
  Object.assign(p, { x: 5.5, z: 1020, speed: 0 });
  w.revision++;
  await page.waitForTimeout(1000);
  await page.keyboard.press('i');
  await page
    .locator('form[data-action="tender"]')
    .filter({ has: page.locator('[name="operation"][value="hook"]') })
    .getByRole('button')
    .click();
  await expect.poll(() => w.mooredBoats?.[p.id + ':33']?.towedBy).toBe(30);
  await page.keyboard.press('Escape');
  // A separate fixture verifies the tug's free self-recovery agreement and physical line.
  delete w.mooredBoats;
  Object.assign(p, {
    vehicle: 32,
    x: 0,
    z: 1040,
    speed: 0,
    fuel: 512,
    fuelVehicle: 32,
    parkedFuel: { 30: 0 },
    engine: true,
    boatThrottle: 0,
  });
  w.boatRescues = {
    [p.id]: {
      boat: { x: 0, z: 1000, heading: 0, slot: 30, paint: 'blue' },
      cargo: { cod: 10 },
      dinghy: { x: 0, z: 200, heading: 0, moored: true },
    },
  };
  w.revision++;
  await page.waitForTimeout(1000);
  await page.locator('[data-do="activities"]').first().click();
  await page.getByRole('button', { name: 'Plan free recovery of your boat' }).click();
  await page.getByRole('button', { name: 'Secure towline' }).click();
  await expect.poll(() => w.towJobs?.[p.id]?.state).toBe('towing');
  await page.keyboard.press('Escape');
  await page.locator('#viewport canvas').click({ position: { x: 800, y: 400 } });
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  await page.keyboard.up('w');
  await page.waitForTimeout(2000);
  await expect.poll(() => w.boatRescues![p.id].boat.z).toBeGreaterThan(1000.5);
  await page.keyboard.press('b');
  await page.locator('[data-do="activities"]').first().click();
  await page.getByRole('button', { name: 'Cancel agreement' }).click();
  await page.keyboard.press('Escape');
  delete w.boatRescues;
  Object.assign(p, { vehicle: 5, x: 50, z: 0, speed: 0, lights: true });
  w.settings.time = 0;
  w.revision++;
  await page.waitForTimeout(1200);
  await expect(page.locator('.bottom-left [data-do=engine]')).toBeHidden();
  await expect(page.locator('.bottom-left [data-do=lights]')).toContainText('Flashlight');
  await page.keyboard.press('c');
  await page.keyboard.press('h');
  await page.screenshot({ path: output + '/walking-flashlight.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Actual UI purchase, cargo loading, articulated driving, unhitching and boat render checks passed.',
  );
  const video = page.video();
  await page.close();
  await video?.saveAs(output + '/walkthrough.webm');
} finally {
  await context.close();
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
