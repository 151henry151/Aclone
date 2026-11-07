// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { parkCurrentVehicle } from '../../src/shared/parked-vehicles';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('find a distant tractor from desktop and phone, with honest empty and map-required states', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-find-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Ada Turnip');
  const w = createWorld('find-tractor', 'Puddlewick', account.id);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.buildings = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    time: 43200,
    dayLength: 0,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'off',
    requireMapItem: false,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, { x: 0, z: 0, y: 0, vehicle: 0, speed: 0, engine: false });
  parkCurrentVehicle(w, p);
  Object.assign(p, { x: 150, z: 150, vehicle: 5, fuelVehicle: 2 });
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('output/find-tractor', { recursive: true });
  try {
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const current = () => app.worlds.get(w.id)!;
    await page
      .locator('.quickbar')
      .getByRole('button', { name: 'Find tractor', exact: true })
      .click({ timeout: 5000 });
    await expect(page.locator('#waypoint-hud')).toBeVisible();
    await expect(page.locator('#waypoint-name')).toHaveText('Your Puddle tractor');
    await expect(page.locator('#waypoint-distance')).toContainText('212m');
    const saved = await page.evaluate(
      (id) => JSON.parse(localStorage.getItem('aclone.waypoint.' + id)!),
      w.id,
    );
    expect(saved).toMatchObject({ x: 0, z: 0 });
    expect(current().players[p.id].x).toBe(150);
    expect(current().parkedVehicles![p.id + ':0'].x).toBe(0);
    await page.screenshot({ path: 'output/find-tractor/desktop-arrow.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#waypoint-clear').click();
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Find tractor', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#waypoint-hud')).toBeVisible();
    await page.screenshot({ path: 'output/find-tractor/phone-arrow.png' });
    current().settings.requireMapItem = true;
    delete current().players[p.id].inventory.parishMap;
    await expect(page.locator('#waypoint-hud')).toBeHidden();
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Find tractor', exact: true })
      .click();
    await expect(page.locator('#toast')).toContainText('map');
    current().settings.requireMapItem = false;
    current().parkedVehicles = {};
    await page.waitForTimeout(1200);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Find tractor', exact: true })
      .click();
    await expect(page.locator('#toast')).toContainText('No parked tractor');
    expect(
      await page.evaluate((id) => JSON.parse(localStorage.getItem('aclone.waypoint.' + id)!), w.id),
    ).toEqual(saved);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
