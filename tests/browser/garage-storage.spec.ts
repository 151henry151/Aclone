// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('store and retrieve land vehicles and trailers, then build and inspect a private storage garage', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/garage-storage', { recursive: true });
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
    z: 14,
    y: 0,
    heading: Math.PI,
    vehicle: 5,
    fleet: [0, 5, 38],
    fuel: 0,
    speed: 0,
    inventory: {},
    cash: 10000000,
    skills: ['builder'],
  });
  let b = makeBuilding('garage', 'garage', 0, 0);
  w.buildings = [b];
  const key = p.id + ':38';
  w.parkedVehicles = {
    [key]: {
      owner: p.id,
      slot: 38,
      x: 18,
      z: 10,
      y: 0,
      heading: 0,
      fuel: 17,
      condition: 63,
      parkedAt: w.time,
    },
  };
  w.trailers = {
    tip: { id: 'tip', owner: p.id, kind: 'dump', x: 19, z: 18, heading: 0, cargo: { dirt: 9 } },
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
    await page.keyboard.press('e');
    const panel = page.locator('[data-garage-storage]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('No vehicles or trailers stored here.');
    const machine = page.locator('[data-garage-unit="Vehicle:38"]');
    await machine.getByRole('button', { name: 'Store in garage' }).click();
    await expect.poll(() => w.parkedVehicles![key].inside).toBe(b.id);
    await expect(machine).toContainText('Stored: Spanner & Sons');
    const trailer = page.locator('[data-garage-unit="Trailer:tip"]');
    await trailer.getByRole('button', { name: 'Store in garage' }).click();
    await expect.poll(() => w.trailers!.tip.storedAt).toBe(b.id);
    await expect(trailer).toContainText('Stored: Spanner & Sons');
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as any).__storageScene.trailers.group.children.length),
      )
      .toBe(0);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/garage-storage/stored-fleet.png' });
    // The exit is too constrained under this valid world setting; retrieval must not consume storage.
    w.settings.parkingSearchRange = 5;
    await machine.getByRole('button', { name: 'Retrieve outside' }).click();
    await expect(
      page.getByText('No safe clear space outside this garage; clear the exit and try again', {
        exact: true,
      }),
    ).toBeVisible();
    expect(w.parkedVehicles![key].inside).toBe(b.id);
    // A refused action replaces the authoritative world with its rollback copy.
    w = app.worlds.get(w.id)!;
    p = w.players[p.id];
    b = w.buildings.find((site) => site.id === b.id)!;
    w.settings.parkingSearchRange = 30;
    await machine.getByRole('button', { name: 'Retrieve outside' }).click();
    await expect.poll(() => w.parkedVehicles![key].inside).toBeUndefined();
    await trailer.getByRole('button', { name: 'Retrieve outside' }).click();
    await expect.poll(() => w.trailers!.tip.storedAt).toBeUndefined();
    await expect
      .poll(() =>
        page.evaluate(() => (globalThis as any).__storageScene.trailers.group.children.length),
      )
      .toBe(1);
    expect(w.parkedVehicles![key].fuel).toBe(17);
    expect(w.trailers!.tip.cargo).toEqual({ dirt: 9 });
    // A remote parked machine cannot be summoned into the garage.
    w.parkedVehicles![key].x = 150;
    await expect(machine).toContainText('Bring it within 30 m');
    await expect(machine.getByRole('button')).toBeDisabled();
    // Build at a separate clear plot using the real designer and foundation action.
    await page.getByRole('button', { name: 'Close dialog' }).click();
    delete p.inside;
    delete p.task;
    delete p.homeParking;
    Object.assign(p, { x: 110, z: 80, y: 0, heading: Math.PI });
    await expect
      .poll(() => page.evaluate(() => Math.round((globalThis as any).__storageScene.target.x)))
      .toBe(110);
    await page.locator('[data-do="construction"]:visible').click();
    await page.getByLabel('Building type', { exact: true }).selectOption('vehicleStorage');
    await expect(
      page.getByLabel('Architectural model', { exact: true }).locator('option'),
    ).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Place foundation' })).toBeEnabled();
    await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/garage-storage/buildable-garage.png' });
    await page.getByRole('button', { name: 'Place foundation' }).click();
    await expect.poll(() => w.buildings.some((b) => b.kind === 'vehicleStorage')).toBe(true);
    const shed = w.buildings.find((b) => b.kind === 'vehicleStorage')!;
    expect(shed.owner).toBe(p.id);
    expect(shed.construction!.steel).toBeGreaterThan(0);
    // Supply the exact construction bill through the normal authoritative action.
    p.inventory = { ...shed.construction! };
    act(w, p.id, { type: 'supply', building: shed.id });
    expect(shed.construction).toBeUndefined();
    Object.assign(p, { x: shed.x, z: shed.z + 14, y: 0, heading: Math.PI });
    await expect
      .poll(() => page.evaluate(() => Math.round((globalThis as any).__storageScene.target.z)))
      .toBe(94);
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              (globalThis as any).__storageScene.buildingMeshes.some(
                (g: any) => g.userData.building === id,
              ),
            shed.id,
          ),
        { timeout: 30000 },
      )
      .toBe(true);
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'output/garage-storage/vehicle-shed.png' });
    await page.keyboard.press('e');
    await expect(panel).toContainText('Private storage garage');
    await expect(panel).toContainText('No vehicles or trailers stored here.');
    const v = w.parkedVehicles![key];
    Object.assign(v, { x: shed.x + 18, z: shed.z + 10 });
    shed.owner = 'another-owner';
    await expect(machine).toContainText('Only the garage owner may store here.');
    await expect(machine.getByRole('button')).toBeDisabled();
    shed.owner = p.id;
    await expect(machine.getByRole('button')).toBeEnabled();
    await machine.getByRole('button').click();
    await expect.poll(() => v.inside).toBe(shed.id);
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.scrollIntoViewIfNeeded();
    await expect(machine.getByRole('button', { name: 'Retrieve outside' })).toBeVisible();
    await page.screenshot({ path: 'output/garage-storage/mobile-storage.png' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
