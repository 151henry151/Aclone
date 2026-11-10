// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('drive into the hangar, board an aircraft, return and retrieve the stored tractor rig', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/hangar-storage', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-garage-storage-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Garage pilot');
  let w = createWorld('garage-storage', 'Garage storage', account.id);
  Object.assign(w, {
    script: '',
    roads: [],
    towns: [],
    zones: [],
    terrain: [],
    airfield: undefined,
    spaceportSite: undefined,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(0),
  };
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    dayLength: 0,
    time: 12 * 3600,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    garageStoresSpareTractors: false,
    arrivalAnimation: 'off',
    vehicleMaintenance: false,
  });
  let p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: 20,
    y: 0,
    heading: Math.PI,
    vehicle: 0,
    fleet: [0, 2, 5],
    fuel: 31,
    fuelVehicle: 0,
    speed: 0,
    inventory: {},
    cash: 10000000,
    skills: ['pilot'],
  });
  let b = makeBuilding('garage', 'garage', 0, 0);
  b.aircraftHangar = true;
  b.name = 'Airfield hangar';
  w.buildings = [b];
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  const key = p.id + ':0';
  w.parkedVehicles = {};
  w.trailers = {
    tip: {
      id: 'tip',
      owner: p.id,
      kind: 'dump',
      x: 0,
      z: 26,
      heading: Math.PI,
      cargo: { dirt: 9 },
      attached: p.id,
    },
  };
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const r = await route.fetch();
      await route.fulfill({
        response: r,
        body: (await r.text()) + '\nglobalThis.__storageScene=scene;\n',
      });
    });
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
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as any).__storageScene.trailers.group.children.length),
      )
      .toBe(1);
    await page.keyboard.down('w');
    await expect.poll(() => p.z).toBeLessThan(17.5);
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.5);
    const fuel = p.fuel;
    await page.keyboard.press('Control');
    await expect.poll(() => p.inside).toBe(b.id);
    await expect(page.getByRole('dialog', { name: 'Airfield hangar', exact: true })).toBeVisible();
    expect(w.parkedVehicles![key].inside).toBe(b.id);
    expect(w.parkedVehicles![key].fuel).toBeCloseTo(fuel, 1);
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as any).__storageScene.trailers.group.children.length),
      )
      .toBe(0);
    const storage = page.locator('[data-fleet-disclosure="garage-storage"]');
    await storage.locator('summary').click();
    await expect(storage).toContainText('Stored: Airfield hangar');
    await storage.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'output/hangar-storage/stored-for-flight.png' });
    await page.getByRole('button', { name: /Biplane.*Board owned aircraft/ }).click();
    await expect.poll(() => p.vehicle).toBe(2);
    expect(w.parkedVehicles![key].inside).toBe(b.id);
    await page.screenshot({ path: 'output/hangar-storage/clear-apron.png' });
    // Return through the actual arrival control; the aircraft parks outside while the rig stays stored.
    await page.keyboard.press('Control');
    await expect.poll(() => p.inside).toBe(b.id);
    const machine = page.locator('[data-garage-unit="Vehicle:0"]');
    await expect(machine.getByRole('button', { name: 'Retrieve outside' })).toBeVisible();
    await machine.getByRole('button', { name: 'Retrieve outside' }).click();
    await expect.poll(() => w.parkedVehicles![key].inside).toBeUndefined();
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as any).__storageScene.trailers.group.children.length),
      )
      .toBe(1);
    expect(w.trailers!.tip.cargo).toEqual({ dirt: 9 });
    expect(w.parkedVehicles![key].fuel).toBeCloseTo(fuel, 1);
    await expect(async () => {
      await machine.scrollIntoViewIfNeeded();
      await expect(machine).toBeInViewport();
    }).toPass();
    await page.screenshot({ path: 'output/hangar-storage/retrieved-rig.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
