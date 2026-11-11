// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
import { butcherRamp } from '../../src/shared/butcher';
import { GARAGE_STORAGE } from '../../src/shared/parked-vehicles';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('a real approach parks the tractor, swings the door, opens the panel after entry, and reverses on Escape', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/parked-vehicles/browser', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-arrival-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Parking pilot'),
    w = createWorld('parked-browser', 'Park and walk', account.id);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
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
    dayLength: 0,
    time: 12 * 3600,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'full',
    arrivalMinSeconds: 4,
    arrivalMaxSeconds: 4,
    respawnX: 300,
    respawnZ: 300,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: 12,
    y: 0,
    heading: Math.PI,
    vehicle: 0,
    fuel: 31,
    fuelVehicle: 0,
    speed: 0,
    engine: false,
  });
  const b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  w.buildings = [b];
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__parkingScene=scene;\n',
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
    await page.keyboard.press('e');
    const current = () => app.worlds.get(w.id)!.players[p.id];
    await expect.poll(() => current().task?.kind).toBe('entering');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const progress = await page.locator('#task-control').boundingBox();
    expect(progress!.height).toBeLessThan(85);
    expect(progress!.y).toBeLessThan(220);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = (globalThis as any).__parkingScene;
          return s.parkedVehicles.group.children.length;
        }),
      )
      .toBe(1);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const s = (globalThis as any).__parkingScene;
            return Math.max(
              ...s.buildingMeshes.flatMap((g: any) =>
                (g.userData.pedestrianDoors ?? []).map((d: any) => Math.abs(d.rotation.y)),
              ),
            );
          }),
        { intervals: [100] },
      )
      .toBeGreaterThan(1);
    await expect.poll(() => current().inside).toBe(b.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({ path: 'output/parked-vehicles/browser/arrival-inside.png' });
    await page.keyboard.press('Escape');
    await expect.poll(() => current().task?.kind).toBe('exiting');
    await expect.poll(() => current().task).toBeUndefined();
    expect(current().inside).toBeUndefined();
    expect(current().vehicle).toBe(5);
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__parkingScene.camera.position.z))
      .toBeGreaterThan(6);
    await page.screenshot({ path: 'output/parked-vehicles/browser/parked-outside.png' });
    await expect(page.getByRole('button', { name: 'Mark parked vehicle' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark parked vehicle' }).click();
    await page.keyboard.press('m');
    await expect(page.locator('[data-parked-vehicle]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect.poll(() => current().inside).toBe(b.id);
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => current().atHome).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Depart in tractor', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Depart on foot', exact: true }).click();
    await expect.poll(() => current().task).toBeUndefined();
    expect(current().vehicle).toBe(5);
    await expect(page.locator('#target [data-do=building]')).toHaveCount(1);
    await page.keyboard.press('e');
    await expect.poll(() => current().inside).toBe(b.id);
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => current().atHome).toBe(true);
    await page.getByRole('button', { name: 'Depart in tractor', exact: true }).click();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('mounting');
    await expect.poll(() => current().task).toBeUndefined();
    expect(current().vehicle).toBe(0);
    await page.keyboard.press('F4');
    await expect.poll(() => current().engine).toBe(true);
    await page.keyboard.down('w');
    await page.waitForTimeout(2500);
    await page.keyboard.up('w');
    await page.keyboard.press('F4');
    await expect.poll(() => Math.abs(current().speed)).toBeLessThan(0.5);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('dismounting');
    await expect.poll(() => current().task).toBeUndefined();
    // Set up the next local test segment beside the parked machine; all transitions
    // below are triggered through the real player controls.
    const parked = app.worlds.get(w.id)!.parkedVehicles![`${p.id}:0`];
    Object.assign(current(), { x: parked.x - 1.4, y: parked.y, z: parked.z });
    await expect(
      page.getByRole('button', { name: 'Get in Puddle tractor', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Get in Puddle tractor', exact: true }).click();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('mounting');
    await expect
      .poll(
        () => page.evaluate(() => (globalThis as any).__parkingScene.mounts.group.children.length),
        { intervals: [50] },
      )
      .toBe(1);
    const anchor = [current().x, current().z];
    await page.keyboard.down('w');
    await page.screenshot({ path: 'output/parked-vehicles/browser/tractor-mount.png' });
    expect([current().x, current().z]).toEqual(anchor);
    await page.keyboard.up('w');
    await expect.poll(() => current().task).toBeUndefined();
    await page.getByRole('button', { name: 'Inventory', exact: false }).first().click();
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('dismounting');
    await expect.poll(() => current().task).toBeUndefined();
    await expect(
      page.getByRole('button', { name: 'Get in Puddle tractor', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Get in Puddle tractor', exact: true }).click();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('mounting');
    await expect.poll(() => current().task).toBeUndefined();
    await expect.poll(() => current().vehicle).toBe(0);
    const garage = makeBuilding('garage', 'garage', 50, 0);
    app.worlds.get(w.id)!.buildings.push(garage);
    Object.assign(current(), {
      x: 50,
      z: 12,
      y: 0,
      heading: Math.PI,
      fleet: [0, 5, 24],
      parkedFuel: { 24: 19 },
    });
    await expect
      .poll(() => page.evaluate(() => (globalThis as any).__parkingScene.buildingMeshes.length))
      .toBe(2);
    await expect.poll(() => page.evaluate(() => (globalThis as any).__parkingScene.me.x)).toBe(50);
    await page.keyboard.press('e');
    await expect.poll(() => current().inside).toBe(garage.id);
    await page.locator('details[data-fleet-disclosure="tractor-shop"] summary').click();
    await expect(page.locator('#tractor-choice')).toBeVisible();
    await page.locator('#tractor-choice').selectOption('24');
    await page.getByRole('button', { name: 'Drive this tractor', exact: true }).click();
    await expect.poll(() => current().vehicle).toBe(24);
    await expect.poll(() => current().task).toBeUndefined();
    expect(current().inside).toBeUndefined();
    expect(app.worlds.get(w.id)!.parkedVehicles![`${p.id}:0`].inside).toBe(GARAGE_STORAGE);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = (globalThis as any).__parkingScene;
          const visibleParked: string[] = [];
          s.scene.traverseVisible((o: any) => {
            if (o.userData.parkedVehicle) visibleParked.push(o.userData.parkedVehicle);
          });
          return visibleParked;
        }),
      )
      .toEqual([]);
    await page.screenshot({ path: 'output/parked-vehicles/browser/garage-drive-out.png' });
    expect(errors).toEqual([]);
  } catch (error) {
    console.log('Failure messages', JSON.stringify(app.worlds.get(w.id)?.messages.slice(-8)));
    await page.screenshot({ path: 'output/parked-vehicles/browser/current-failure.png' });
    throw error;
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('touch, controller and saved world rules share the approach flow, including empty and invalid states', async ({
  browser,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-parking-touch-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: 'output/parked-vehicles/browser/mobile-video' },
    }),
    page = await context.newPage();
  const { account, token } = app.universe.register('Touch parking pilot'),
    w = createWorld('parking-touch', 'Walk to the door', account.id),
    p = addPlayer(w, account.id, account.name);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
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
    time: 12 * 3600,
    dayLength: 0,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'quick',
    arrivalQuickSeconds: 2,
    arrivalRange: 30,
  });
  Object.assign(p, { x: 0, z: 25, y: 0, vehicle: 5, fuel: 0, fuelVehicle: 0 });
  const b = makeBuilding('home', 'home', 0, 0);
  b.owner = p.id;
  w.buildings = [b];
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!.players[p.id],
    currentWorld = () => app.worlds.get(w.id)!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        (globalThis as any).testPad = {
          connected: true,
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        };
        Object.defineProperty(navigator, 'getGamepads', {
          value: () => [(globalThis as any).testPad],
        });
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await expect(page.locator('#parked-status')).toBeHidden();
    const beforeOutside = { x: current().x, z: current().z, vehicle: current().vehicle };
    await page.locator('[data-do="mobile-actions"]').tap();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Trade & services outside', exact: true })
      .tap();
    expect(current().inside).toBeUndefined();
    expect(current().task).toBeUndefined();
    expect({ x: current().x, z: current().z, vehicle: current().vehicle }).toEqual(beforeOutside);
    await page.keyboard.press('Escape');
    await page.locator('#mobile-target [data-do="building"]').tap();
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('entering');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => current().inside).toBe(b.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    const pulse = async (index: number) => {
      await page.evaluate((i) => {
        (globalThis as any).testPad.buttons[i].pressed = true;
      }, index);
      await page.waitForTimeout(120);
      await page.evaluate((i) => {
        (globalThis as any).testPad.buttons[i].pressed = false;
      }, index);
    };
    await pulse(1);
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('exiting');
    await expect.poll(() => current().task).toBeUndefined();
    await expect(page.locator('#target [data-do=building]')).toHaveCount(1);
    await pulse(0);
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('entering');
    await expect.poll(() => current().inside).toBe(b.id);
    await pulse(1);
    await expect.poll(() => current().task?.kind, { intervals: [50] }).toBe('exiting');
    await expect.poll(() => current().task).toBeUndefined();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Parked vehicles and arrivals', exact: true });
    await group.locator('[name="parkingReturnRange"]').fill('4');
    await group.locator('[name="arrivalMinSeconds"]').fill('5');
    await group.locator('[name="arrivalMaxSeconds"]').fill('4');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText(
      'Shortest arrival must not exceed longest arrival',
    );
    expect(currentWorld().settings.parkingReturnRange).toBe(3);
    await group.locator('[name="arrivalMinSeconds"]').fill('2');
    await group.locator('[name="arrivalAnimation"]').selectOption('off');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => currentWorld().settings.parkingReturnRange).toBe(4);
    await expect.poll(() => currentWorld().settings.arrivalAnimation).toBe('off');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="parkingReturnRange"]')).toHaveValue('4');
    await expect(group.locator('[name="arrivalAnimation"]')).toHaveValue('off');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/parked-vehicles/browser/mobile-parking-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.locator('#mobile-target [data-do="building"]').tap();
    await expect.poll(() => current().inside).toBe(b.id);
    expect(current().task).toBeUndefined();
    await page.screenshot({ path: 'output/parked-vehicles/browser/mobile-arrival.png' });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('another client sees signed-off vehicles and reconnect restores driving or walking once', async ({
  browser,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-parking-session-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const driver = app.universe.register('Leaving driver'),
    observer = app.universe.register('Parking observer');
  const w = createWorld('parking-session', 'Parked between visits', driver.account.id),
    p = addPlayer(w, driver.account.id, driver.account.name),
    q = addPlayer(w, observer.account.id, observer.account.name);
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
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
    time: 12 * 3600,
    dayLength: 0,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'quick',
  });
  Object.assign(p, { x: 0, z: 0, y: 0, fuel: 31, fuelVehicle: 0, speed: 0, engine: false });
  Object.assign(q, { x: 10, z: 10, y: 0, vehicle: 5 });
  app.worlds.set(w.id, w);
  const a = await browser.newContext(),
    b = await browser.newContext(),
    page = await a.newPage(),
    watch = await b.newPage();
  const state = () => app.worlds.get(w.id)!,
    me = () => state().players[p.id];
  const errors: string[] = [];
  for (const tab of [page, watch]) tab.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen(),
      url = `http://127.0.0.1:${port}`;
    for (const [tab, token] of [
      [page, driver.token],
      [watch, observer.token],
    ] as const) {
      await tab.route('**/src/client/main.ts', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body: (await response.text()) + '\nglobalThis.__parkingScene=scene;\n',
        });
      });
      await tab.addInitScript(
        ({ token, world }) => {
          if (location.protocol === 'about:') return;
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', world);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token, world: w.id },
      );
      await tab.goto(url);
      await waitForWorld(tab);
    }
    await page.goto('about:blank');
    await expect.poll(() => me().online).toBe(false);
    expect(state().parkedVehicles![`${p.id}:0`].fuel).toBe(31);
    await expect
      .poll(() =>
        watch.evaluate((id) => {
          const s = (globalThis as any).__parkingScene;
          const g = s.parkedVehicles.group.children.find(
            (g: any) => g.userData.parkedVehicle === `${id}:0`,
          );
          return !!g && !g.userData.driver?.visible;
        }, p.id),
      )
      .toBe(true);
    await watch.screenshot({ path: 'output/parked-vehicles/browser/signed-off-tractor.png' });
    await page.goto(url);
    await waitForWorld(page);
    await expect.poll(() => me().vehicle).toBe(0);
    expect(me().fuel).toBe(31);
    expect(state().parkedVehicles?.[`${p.id}:0`]).toBeUndefined();
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(5);
    await expect.poll(() => me().task).toBeUndefined();
    const position = [me().x, me().z];
    await page.goto('about:blank');
    await expect.poll(() => me().online).toBe(false);
    await page.goto(url);
    await waitForWorld(page);
    expect(me().vehicle).toBe(5);
    expect([me().x, me().z]).toEqual(position);
    expect(state().parkedVehicles![`${p.id}:0`].fuel).toBe(31);
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty tractor stays behind while its driver walks to buy fuel, returns, refuels and drives', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-parking-fuel-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Stranded driver'),
    w = createWorld('parking-fuel', 'Walk to the pump', account.id),
    p = addPlayer(w, account.id, account.name);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
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
    dayLength: 0,
    time: 12 * 3600,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'quick',
  });
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 0,
    heading: Math.PI,
    vehicle: 0,
    fuel: 0,
    fuelVehicle: 0,
    speed: 0,
    engine: false,
    inventory: {},
    cash: 10000,
  });
  const shop = makeBuilding('fuel-shop', 'market', 0, -25);
  shop.stock.fuel = 100;
  shop.sell.fuel = 25;
  w.buildings = [shop];
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!.players[p.id],
    state = () => app.worlds.get(w.id)!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => current().task).toBeUndefined();
    await expect(page.locator('#parked-status')).toContainText('Out of fuel');
    await expect(
      page.getByRole('button', { name: 'Refuel parked vehicle', exact: true }),
    ).toBeDisabled();
    await page.keyboard.down('w');
    await expect.poll(() => current().z).toBeLessThan(-9);
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(current().speed)).toBeLessThan(0.5);
    await expect(page.getByRole('button', { name: 'Board vehicle', exact: true })).toBeDisabled();
    await expect(page.locator('#parked-status')).toContainText(/Walk to your tractor first/);
    expect(state().parkedVehicles![`${p.id}:0`].z).toBe(0);
    await page.screenshot({ path: 'output/parked-vehicles/browser/stranded-walk.png' });
    await page.keyboard.press('e');
    await expect.poll(() => current().inside).toBe(shop.id);
    await page.locator('[data-do="trade"][data-item="fuel"][data-direction="buy"]').first().click();
    await expect.poll(() => current().inventory.fuel).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect.poll(() => current().task).toBeUndefined();
    await expect(page.locator('#parked-status')).toBeVisible();
    await page.keyboard.down('s');
    await expect
      .poll(() => Math.hypot(current().x, current().z))
      .toBeLessThan(state().settings.parkingReturnRange!);
    await page.keyboard.up('s');
    await expect.poll(() => Math.abs(current().speed)).toBeLessThan(0.5);
    await page.screenshot({ path: 'output/parked-vehicles/browser/returned-to-tractor.png' });
    const fuel = current().inventory.fuel;
    await page.getByRole('button', { name: 'Refuel parked vehicle', exact: true }).click();
    await expect.poll(() => state().parkedVehicles![`${p.id}:0`].fuel).toBe(8);
    expect(current().inventory.fuel).toBe(fuel - 1);
    await page.getByRole('button', { name: 'Board vehicle', exact: true }).click();
    await expect.poll(() => current().task).toBeUndefined();
    expect(current().vehicle).toBe(0);
    await page.keyboard.press('F4');
    await expect.poll(() => current().engine).toBe(true);
    await page.keyboard.down('w');
    await expect.poll(() => Math.abs(current().speed)).toBeGreaterThan(1);
    await page.keyboard.up('w');
    await page.screenshot({ path: 'output/parked-vehicles/browser/refuelled-driving.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('outdoor garage services retain the tractor and hitch while ordinary entry still walks inside', async ({
  page,
}) => {
  page.setDefaultTimeout(10000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-outdoor-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Outdoor haulier');
  const w = createWorld('outdoor-services', 'Outdoor services', account.id);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
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
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    arrivalAnimation: 'quick',
    respawnX: 300,
    respawnZ: 300,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: 14,
    y: 0,
    heading: Math.PI,
    vehicle: 0,
    fuelVehicle: 0,
    fuel: 20,
    speed: 0,
    engine: false,
    cash: 10000000,
    inventory: { steel: 1 },
  });
  p.fleetState = { 0: { condition: 75, metres: 0, acquiredAt: 0 } };
  const b = makeBuilding('garage', 'garage', 0, 0);
  b.stock = { fuel: 100 };
  b.sell = { fuel: 100 };
  w.buildings = [b];
  app.worlds.set(w.id, w);
  const state = () => app.worlds.get(w.id)!,
    current = () => state().players[p.id];
  try {
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page
      .getByRole('button', { name: 'Trade & services outside', exact: true })
      .first()
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(current().vehicle).toBe(0);
    expect(current().inside).toBeUndefined();
    expect(current().task).toBeUndefined();
    await page
      .getByRole('button', { name: /Service.*vehicle|Service.*repair|Service.*Steel/i })
      .first()
      .click();
    await expect.poll(() => current().fleetState?.[0].condition).toBe(100);
    const buy = page
      .locator('form[data-action="trailer"]')
      .filter({ has: page.locator('input[name="kind"][value="box"]') });
    await buy.getByRole('button', { name: 'Buy & hitch', exact: true }).click();
    await expect.poll(() => Object.values(state().trailers ?? {}).length).toBe(1);
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: 'Trade & services outside', exact: true })
      .first()
      .click();
    const trade = page
      .locator('form[data-action="trade"]')
      .filter({ has: page.locator('input[name="storage"][value="trailer"]') })
      .filter({ has: page.locator('input[name="direction"][value="buy"]') });
    await trade.locator('select[name="item"]').selectOption('fuel');
    await trade.getByRole('button', { name: 'Buy into trailer', exact: true }).click();
    await expect.poll(() => Object.values(state().trailers!)[0].cargo.fuel).toBe(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect.poll(() => current().inside).toBe(b.id);
    await expect.poll(() => current().vehicle).toBe(5);
    expect(Object.values(state().trailers!)[0].parkedWith).toBe(`${p.id}:0`);
    await page.screenshot({ path: 'output/parked-vehicles/browser/outdoor-services.png' });
    await page.keyboard.press('Escape');
    await expect.poll(() => current().task).toBeUndefined();
    const butcher = makeBuilding('butcher', 'butcher', 100, 0);
    butcher.architecture = 'model-1';
    const worker = addPlayer(state(), 'butcher-worker', 'Butcher');
    Object.assign(worker, { skills: ['butcher'], job: butcher.id, activeUntil: 100000 });
    butcher.employees = [worker.id];
    state().buildings.push(butcher);
    Object.assign(state().settings, { activeWork: false, slaughterSeconds: 1 });
    Object.assign(current(), butcherRamp(butcher), { y: 0, speed: 0, inventory: { chickens: 1 } });
    state().revision++;
    await expect(
      page.locator('#target [data-do="building-outside"][data-id="butcher"]'),
    ).toBeVisible();
    await page.locator('#target [data-do="building-outside"][data-id="butcher"]').click();
    const service = page
      .locator('form[data-action="butcher"]')
      .filter({ has: page.locator('input[name="item"][value="chickens"]') });
    await service.getByRole('button').click();
    await expect.poll(() => current().inventory.poultry).toBe(1);
    expect(current().inside).toBeUndefined();
    await page.screenshot({ path: 'output/parked-vehicles/browser/outdoor-butcher.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
