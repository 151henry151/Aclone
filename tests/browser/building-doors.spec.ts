// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('real scene opens furnished bays on the clock and edits door rules without rebuilding stock', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/building-interiors/browser', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-doors-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { account, token } = app.universe.register('Door builder'),
    w = createWorld('doors-browser', 'Working workshops', account.id);
  w.script = '';
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    dayLength: 0,
    time: 6 * 3600,
    hungerRate: 0,
    thirstRate: 0,
    buildingDoorOffsetMinutes: 0,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(0),
  };
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: 16,
    y: 0,
    vehicle: 5,
    engine: false,
    heading: Math.PI,
    vehiclePaints: { 2: 'plum' },
  });
  w.buildings = ['workshop', 'garage', 'warehouse'].map((kind, i) => {
    const b = makeBuilding(kind, kind, i * 30, 0);
    b.architecture = 'model-1';
    b.owner = p.id;
    b.employees = [p.id];
    return b;
  });
  const hangar = makeBuilding('hangar', 'garage', -35, 0);
  hangar.aircraftHangar = true;
  w.buildings.push(hangar);
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!;
  let passed = false;
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__doorsUnderTest=scene;\n',
      });
    });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        if (!localStorage.getItem('aclone.quality'))
          localStorage.setItem('aclone.quality', 'normal');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const state = () =>
      page.evaluate(() => {
        const s = (globalThis as any).__doorsUnderTest;
        return s.buildingMeshes
          .filter((g: any) => g.userData.interiors?.length)
          .map((g: any) => ({
            id: g.userData.building,
            uuid: g.uuid,
            open: g.userData.interiors[0].doors[0].openness,
            visible: g.userData.interiors[0].group.visible,
            detail: g.userData.interiors[0].detail.visible,
            tier: g.userData.interiors[0].group.userData.stockTier,
          }));
      });
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.open)
      .toBe(0);
    await page.screenshot({ path: 'output/building-interiors/browser/closed.png' });
    const moveTo = async (x: number, z = 16) => {
      Object.assign(current().players[p.id], { x, z });
      await page.waitForTimeout(1200);
    };
    const original = (await state()).find((b: any) => b.id === 'warehouse')!.uuid;
    current().settings.time = 8 * 3600;
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.open)
      .toBeGreaterThan(0);
    const during = (await state()).find((b: any) => b.id === 'workshop')!.open;
    expect(during).toBeLessThan(1);
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.open)
      .toBe(1);
    await expect(
      page.evaluate(async () => {
        const T = await import('/node_modules/three/build/three.module.js' as string);
        const s = (globalThis as any).__doorsUnderTest,
          g = s.buildingMeshes.find((g: any) => g.userData.building === 'workshop'),
          rig = g.userData.interiors[0],
          door = rig.doors[0];
        const origin = door.group.localToWorld(new T.Vector3(0, 1, 2));
        const direction = new T.Vector3(0, 0, -1).transformDirection(door.group.matrixWorld);
        return {
          attached: door.panels.every((p: any) => p.parent === door.group),
          clear: new T.Raycaster(origin, direction).intersectObject(door.group, true).length === 0,
          floor: !!rig.group.getObjectByName('interior-floor'),
        };
      }),
    ).resolves.toEqual({ attached: true, clear: true, floor: true });
    await page.screenshot({ path: 'output/building-interiors/browser/open-workshop.png' });
    await moveTo(-35, 22);
    await page.screenshot({ path: 'output/building-interiors/browser/open-hangar.png' });
    await moveTo(30);
    await page.screenshot({ path: 'output/building-interiors/browser/open-garage.png' });
    await moveTo(60);
    const warehouse = current().buildings.find((b) => b.id === 'warehouse')!;
    warehouse.stock = { wood: warehouse.capacity };
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'warehouse')?.tier)
      .toBe(3);
    expect((await state()).find((b: any) => b.id === 'warehouse')!.uuid).toBe(original);
    await page.screenshot({ path: 'output/building-interiors/browser/full-warehouse.png' });
    for (const [fraction, tier] of [
      [0.1, 1],
      [0.5, 2],
    ]) {
      warehouse.stock = { wood: Math.floor(warehouse.capacity * fraction) };
      await expect
        .poll(async () => (await state()).find((b: any) => b.id === 'warehouse')?.tier)
        .toBe(tier);
      expect((await state()).find((b: any) => b.id === 'warehouse')!.uuid).toBe(original);
    }
    warehouse.stock = {};
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'warehouse')?.tier)
      .toBe(0);
    await page.screenshot({ path: 'output/building-interiors/browser/empty-warehouse.png' });
    await moveTo(0);
    current().buildings.find((b) => b.id === 'workshop')!.employees = [];
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.open)
      .toBe(0);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const fieldset = page.getByRole('group', { name: 'Building doors', exact: true });
    const opening = fieldset.locator('[name="buildingDoorOpenHour"]');
    await opening.fill('27');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    expect(await opening.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    expect(current().settings.buildingDoorOpenHour).toBe(7);
    await opening.fill('7');
    await fieldset.locator('[name="buildingDoorMode"]').selectOption('open');
    await fieldset.locator('[name="buildingInteriorDetail"]').selectOption('reduced');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.buildingDoorMode).toBe('open');
    await page.screenshot({ path: 'output/building-interiors/browser/world-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.open)
      .toBe(1);
    expect((await state()).find((b: any) => b.id === 'workshop')!.detail).toBe(false);
    await page.reload();
    await waitForWorld(page);
    expect((await state()).find((b: any) => b.id === 'workshop')!.open).toBe(1);
    current().settings.buildingInteriorDetail = 'none';
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'workshop')?.visible)
      .toBe(false);
    current().settings.buildingInteriorDetail = 'full';
    current().settings.buildingDoorMode = 'hours';
    current().settings.time = 20 * 3600;
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'garage')?.open)
      .toBe(0);
    // Far-away doors snap on the next update instead of running their five-second track.
    await moveTo(250);
    current().settings.buildingDoorMode = 'open';
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'garage')?.open)
      .toBe(1);
    const construction = current().buildings.find((b) => b.id === 'garage')!;
    construction.construction = { wood: 10 };
    await expect.poll(async () => (await state()).some((b: any) => b.id === 'garage')).toBe(false);
    delete construction.construction;
    await expect
      .poll(async () => (await state()).find((b: any) => b.id === 'garage')?.open)
      .toBe(1);
    await page.evaluate(() => localStorage.setItem('aclone.quality', 'low'));
    await page.reload();
    await waitForWorld(page);
    expect((await state()).find((b: any) => b.id === 'workshop')!.detail).toBe(false);
    expect(errors).toEqual([]);
    passed = true;
  } finally {
    const video = page.video();
    await page.close();
    if (passed && video)
      copyFileSync(await video.path(), 'output/building-interiors/browser/doors-rules-stock.webm');
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
