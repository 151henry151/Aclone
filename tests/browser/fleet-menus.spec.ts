// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('fleet menus collapse long lists, retain disclosure state and work at a hangar and on mobile', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/fleet-menus', { recursive: true });
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
  const hangar = makeBuilding('hangar', 'garage', 100, 0);
  hangar.aircraftHangar = true;
  hangar.name = 'Airfield hangar';
  w.buildings.push(hangar);
  for (let i = 0; i < 10; i++)
    w.trailers!['spare' + i] = {
      id: 'spare' + i,
      owner: p.id,
      kind: 'dump',
      x: 0,
      z: 0,
      heading: 0,
      cargo: {},
      storedAt: b.id,
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
    const disclosure = (key: string) => page.locator(`details[data-fleet-disclosure="${key}"]`);
    for (const key of ['owned-trailers', 'trailer-shop', 'tractor-shop', 'garage-storage']) {
      await expect(disclosure(key)).toBeVisible();
      await expect(disclosure(key)).not.toHaveAttribute('open', '');
    }
    await expect(disclosure('owned-trailers').locator('summary')).toHaveText('Your trailers (11)');
    await expect(
      disclosure('owned-trailers').getByText('Quarry tipping trailer', { exact: true }).first(),
    ).toBeHidden();
    await disclosure('owned-trailers').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'output/fleet-menus/garage-collapsed.png' });
    await disclosure('owned-trailers').locator('summary').click();
    await expect(
      disclosure('owned-trailers').getByText('Quarry tipping trailer', { exact: true }).first(),
    ).toBeVisible();
    await disclosure('owned-trailers').locator('summary').click();
    await disclosure('garage-storage').locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(disclosure('garage-storage')).toHaveAttribute('open', '');
    const machine = page.locator('[data-garage-unit="Vehicle:38"]');
    await machine.getByRole('button', { name: 'Store in garage' }).click();
    await expect.poll(() => w.parkedVehicles![key].inside).toBe(b.id);
    await expect(machine).toContainText('Stored: Spanner & Sons');
    await expect(disclosure('garage-storage')).toHaveAttribute('open', '');
    await expect(disclosure('owned-trailers')).not.toHaveAttribute('open', '');
    await machine.getByRole('button', { name: 'Retrieve outside' }).click();
    await expect.poll(() => w.parkedVehicles![key].inside).toBeUndefined();
    await expect(disclosure('garage-storage')).toHaveAttribute('open', '');
    await disclosure('garage-storage').locator('summary').click();
    await disclosure('tractor-shop').locator('summary').click();
    await expect(page.locator('#tractor-choice')).toBeVisible();
    await expect(page.locator('#tractor-preview canvas')).toBeVisible();
    await page.locator('#tractor-choice').selectOption('24');
    await expect(page.locator('#tractor-specs')).toContainText('Orchard Wren');
    await disclosure('tractor-shop').locator('summary').click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    Object.assign(p, { x: 100, z: 14, y: 0 });
    delete p.inside;
    delete p.task;
    await expect(
      page.getByRole('button', { name: 'Ctrl / E Airfield hangar ↗', exact: true }),
    ).toContainText('Airfield hangar');
    await page.keyboard.press('e');
    await expect(disclosure('owned-trailers')).not.toHaveAttribute('open', '');
    await expect(page.getByRole('button', { name: /Biplane/ })).toBeVisible();
    await disclosure('owned-trailers').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: 'output/fleet-menus/hangar-collapsed.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await disclosure('owned-trailers').locator('summary').click();
    await expect(
      disclosure('owned-trailers').getByText('Quarry tipping trailer', { exact: true }).first(),
    ).toBeVisible();
    await disclosure('owned-trailers').locator('summary').click();
    await page.screenshot({ path: 'output/fleet-menus/mobile-collapsed.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    w.trailers = {};
    await page.getByRole('button', { name: 'Extra Info', exact: true }).click();
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await expect(disclosure('owned-trailers')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
