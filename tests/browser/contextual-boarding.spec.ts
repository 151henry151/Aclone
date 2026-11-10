// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { nameTagRules } from '../../src/shared/name-tag-rules';
import { waitForWorld } from './fixtures/ready';
test.use({ actionTimeout: 15000 });
test('quiet contextual names and obvious boarding work in a crowded street on desktop and mobile', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/context-labels', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-context-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Fleet pilot');
  const w = createWorld('context', 'Neighbourhood', account.id);
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
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    vehiclesPersist: true,
    garageStoresSpareTractors: false,
    arrivalAnimation: 'off',
    vehicleMaintenance: false,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 200,
    z: 180,
    y: 0,
    vehicle: 5,
    heading: 0,
    speed: 0,
    fleet: [0, 5, 24, 38, 39],
    fuelVehicle: 24,
    lastTractor: 24,
    inventory: {},
    skills: ['plant operator'],
  });
  const garage = makeBuilding('garage', 'garage', 120, 180),
    home = makeBuilding('home', 'home', 220, 210);
  home.name = 'Orchard House';
  const rear = makeBuilding('rear', 'home', 220, 240);
  rear.name = 'Hidden House';
  w.buildings = [garage, home, rear];
  const record = (owner: string, slot: number, x: number, z: number) => ({
    owner,
    slot,
    x,
    z,
    y: 0,
    heading: 0,
    fuel: 25,
    condition: 90,
    parkedAt: w.time,
  });
  w.parkedVehicles = {
    [p.id + ':24']: { ...record(p.id, 24, 120, 180), inside: garage.id, garageStored: true },
    [p.id + ':39']: record(p.id, 39, 200, 190),
    [p.id + ':0']: record(p.id, 0, 208, 190),
    'other:38': record('other', 38, 192, 190),
  };
  for (let i = 0; i < 16; i++)
    w.parkedVehicles['distant' + i + ':0'] = record('Neighbour ' + i, 0, 176 + i * 3, 260);
  const neighbour = addPlayer(w, 'neighbour', 'Ada Mercer');
  Object.assign(neighbour, {
    x: 196,
    z: 186,
    y: 0,
    vehicle: 5,
    online: true,
    speed: 0,
    heading: 0,
    npc: true,
  });
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const r = await route.fetch();
      await route.fulfill({
        response: r,
        body: (await r.text()) + '\nglobalThis.__contextScene=scene;\n',
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
    const names = () =>
      page.evaluate(() => {
        const s = (globalThis as any).__contextScene;
        return [
          ...s.meshes.values(),
          ...s.parkedVehicles.group.children,
          ...s.buildingMeshes,
        ].flatMap((g: any) => {
          const tag = g.userData.pilotLabel ?? g.userData.buildingLabel;
          if (!g.visible || !tag?.visible) return [];
          const v = tag.position.clone();
          tag.getWorldPosition(v);
          v.project(s.camera);
          const sc = tag.scale.clone();
          tag.getWorldScale(sc);
          const pos = tag.position.clone();
          tag.getWorldPosition(pos);
          pos.applyMatrix4(s.camera.matrixWorldInverse);
          const ppm =
            s.container.clientHeight / (2 * -pos.z * Math.tan((s.camera.fov * Math.PI) / 360));
          return [
            {
              id: g.userData.parkedVehicle ?? g.userData.playerId ?? g.userData.building,
              x: ((v.x + 1) * s.container.clientWidth) / 2,
              y: ((1 - v.y) * s.container.clientHeight) / 2,
              width: sc.x * ppm,
              height: sc.y * ppm,
            },
          ];
        });
      });
    await expect.poll(async () => (await names()).some((n) => n.id === p.id + ':39')).toBe(true);
    const checkNames = async () => {
      const visible = await names();
      expect(visible.length).toBeLessThanOrEqual(nameTagRules(w.settings).nameTagMaxVisible);
      for (const n of visible) {
        expect(n.id).not.toMatch(/^distant/);
        expect(n.height).toBeLessThanOrEqual(18.01);
      }
      for (let i = 0; i < visible.length; i++)
        for (let j = i + 1; j < visible.length; j++) {
          const a = visible[i],
            b = visible[j];
          expect(
            Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
              Math.abs(a.y - b.y) >= (a.height + b.height) / 2,
          ).toBe(true);
        }
      return visible;
    };
    await checkNames();
    await page.screenshot({ path: 'output/context-labels/quiet-street.png' });
    await page.keyboard.press('h');
    await expect.poll(async () => (await names()).length).toBe(0);
    await page.keyboard.press('h');
    await page.mouse.move(700, 400);
    await page.mouse.down();
    await page.mouse.move(1120, 400, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await names()).some((n) => n.id === p.id + ':39')).toBe(false);
    expect(p.vehicle).toBe(5);
    // Return the actual orbit to the original direction by dragging back.
    await page.mouse.move(1120, 400);
    await page.mouse.down();
    await page.mouse.move(700, 400, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await names()).some((n) => n.id === p.id + ':39')).toBe(true);
    await page.keyboard.press('i');
    await expect(page.locator('[data-boarding-panel]')).toContainText(
      'No owned parked vehicle within boarding reach',
    );
    await page.getByRole('button', { name: 'Close dialog' }).click();
    Object.assign(p, { x: 204, z: 190, y: 0 });
    await expect(page.locator('#parked-status')).toContainText('Backhoe');
    await expect(
      page.locator('#parked-status').getByRole('button', { name: 'Get in Backhoe', exact: true }),
    ).toBeEnabled();
    p.skills = [];
    await page.keyboard.press('i');
    const board = page.locator('[data-boarding-panel]');
    await expect(board).toContainText('plant operator');
    await expect(board.getByRole('button', { name: 'Get in Backhoe' })).toBeDisabled();
    p.skills = ['plant operator'];
    await expect(board.getByRole('button', { name: 'Get in Backhoe' })).toBeEnabled();
    await page.screenshot({ path: 'output/context-labels/board-backhoe.png' });
    await board.getByRole('button', { name: 'Get in Backhoe' }).click();
    await expect.poll(() => p.vehicle).toBe(39);
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    await expect(page.getByRole('button', { name: 'Close dialog' })).toHaveCount(0);
    await page
      .locator('#parked-status')
      .getByRole('button', { name: 'Get in Backhoe', exact: true })
      .click();
    await expect.poll(() => p.vehicle).toBe(39);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    await expect(page.getByRole('button', { name: 'Close dialog' })).toHaveCount(0);
    Object.assign(p, { x: 211, z: 190, y: 0 });
    await expect(page.locator('#parked-status')).toContainText('Puddle tractor');
    await expect
      .poll(() => page.evaluate(() => Math.round((globalThis as any).__contextScene.target.x)))
      .toBe(211);
    const point = await page.evaluate((id) => {
      const s = (globalThis as any).__contextScene,
        g = s.parkedVehicles.group.children.find((g: any) => g.userData.parkedVehicle === id);
      const v = g.position.clone();
      v.y += 1.5;
      v.project(s.camera);
      return {
        x: ((v.x + 1) * s.container.clientWidth) / 2,
        y: ((1 - v.y) * s.container.clientHeight) / 2,
      };
    }, p.id + ':0');
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => p.vehicle).toBe(0);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    await expect(page.getByRole('button', { name: 'Close dialog' })).toHaveCount(0);
    Object.assign(p, { x: 220, z: 192, y: 0, heading: 0 });
    await expect.poll(async () => (await names()).some((n) => n.id === 'home')).toBe(true);
    await expect.poll(async () => (await names()).some((n) => n.id === 'rear')).toBe(false);
    await checkNames();
    await page.screenshot({ path: 'output/context-labels/focused-house.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Pilot name tags', exact: true });
    await group.locator('[name="worldNameTags"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.worldNameTags).toBe(false);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect.poll(async () => (await names()).some((n) => n.id === 'home')).toBe(false);
    Object.assign(p, { x: 204, z: 190, y: 0 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('i');
    await expect(board.getByRole('button', { name: 'Get in Backhoe' })).toBeVisible();
    await page.screenshot({ path: 'output/context-labels/mobile-boarding.png' });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
