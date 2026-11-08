// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { landscapeSchema } from '../../src/shared/landscape';
import { growRoads } from '../../src/shared/roads';
import { roadDistance } from '../../src/shared/town';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('watch a connected network gain a shortcut, drive it and change alternate-route policy', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-alternates-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Road driver');
  const w = createWorld('alternate-road-browser', 'Three villages', account.id);
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
  w.buildings = [];
  w.zones = [];
  w.terrain = [];
  w.script = '';
  delete w.airfield;
  delete w.spaceportSite;
  Object.assign(w.settings, {
    mapSize: 1600,
    seaLevel: -10,
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
  });
  const a = { x: -300, z: 0 },
    b = { x: 0, z: -600 },
    c = { x: 300, z: 0 };
  const template = structuredClone(w.towns[0]);
  w.towns = [a, b, c].map((p, i) => ({
    ...structuredClone(template),
    ...p,
    id: 'village-' + i,
    name: ['West village', 'South village', 'East village'][i],
    radius: 40,
  }));
  w.roads = [
    { a, b, width: 5 },
    { a: b, b: c, width: 5 },
  ];
  const original = structuredClone(w.roads);
  const driver = addPlayer(w, account.id, account.name);
  Object.assign(driver, {
    ...a,
    y: 10,
    heading: Math.PI / 2,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 24, 5],
    fuelVehicle: 24,
    fuel: 40,
    engine: true,
    speed: 0,
  });
  app.worlds.set(w.id, w);
  const evidence = 'output/road-alternates/browser';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const day = () => {
    const from = (w.roadGrowth ?? 0) * 600;
    growRoads(w, from, from + 600);
    const deadline = performance.now() + 10000;
    while ((w.roadGrowth ?? 0) < from / 600 + 1 && performance.now() < deadline)
      growRoads(w, from, from + 600);
    expect(w.roadGrowth).toBe(from / 600 + 1);
  };
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
    await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
    await expect(map).toBeVisible();
    await page.screenshot({ path: evidence + '/connected-network-before.png' });
    const roadInk = map.locator('path[stroke="#c5b88e"]');
    const beforeInk = await roadInk.first().getAttribute('d');
    const terrain = map.locator('.map-terrain');
    await expect(terrain).toHaveAttribute('data-rendered-job', /[0-9]+/);
    const terrainJob = await terrain.getAttribute('data-rendered-job');
    const zoomButton = map.getByRole('button', { name: 'Zoom in', exact: true });
    await zoomButton.focus();
    const viewport = map.locator('.parish-map-viewport');
    const scroll = await viewport.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    day();
    expect(w.roadProject?.kind).toBe('alternate');
    expect(w.roads.length).toBeGreaterThan(2);
    const route = [a, ...structuredClone(w.roadProject!.path), c];
    await expect(roadInk.first()).not.toHaveAttribute('d', beforeInk!);
    await expect(terrain).toHaveAttribute('data-rendered-job', terrainJob!);
    await expect(zoomButton).toBeFocused();
    expect(await viewport.evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual(scroll);
    await page.screenshot({ path: evidence + '/shortcut-first-day.png' });
    for (let i = 0; i < 80 && w.roadProject; i++) day();
    expect(w.roadProject).toBeUndefined();
    expect(w.roads.slice(0, 2)).toEqual(original);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: evidence + '/completed-road-loop.png' });
    const finished = structuredClone(w.roads);
    day();
    expect(w.roads).toEqual(finished);
    await page.keyboard.press('m');
    await expect(map).not.toBeVisible();
    await page.keyboard.down('w');
    try {
      let waypoint = 1;
      const deadline = Date.now() + 90000;
      while (driver.x < 275 && Date.now() < deadline) {
        while (
          waypoint < route.length - 1 &&
          Math.hypot(route[waypoint].x - driver.x, route[waypoint].z - driver.z) < 12
        )
          waypoint++;
        const target = route[waypoint];
        const heading = Math.atan2(target.x - driver.x, target.z - driver.z);
        const turn = Math.atan2(
          Math.sin(heading - driver.heading),
          Math.cos(heading - driver.heading),
        );
        await page.keyboard.up('a');
        await page.keyboard.up('d');
        if (Math.abs(turn) > 0.04) await page.keyboard.down(turn > 0 ? 'a' : 'd');
        await page.waitForTimeout(100);
        expect(roadDistance(w.roads, driver.x, driver.z)).toBeLessThan(6);
      }
      expect(driver.x).toBeGreaterThan(275);
    } finally {
      await page.keyboard.up('w');
      await page.keyboard.up('a');
      await page.keyboard.up('d');
    }
    await page.keyboard.press('F4');
    await page.screenshot({ path: evidence + '/shortcut-arrival.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Roads and river crossings', exact: true });
    await expect(group.locator('[name="roadAlternateRoutes"]')).toBeChecked();
    await group.locator('[name="roadAlternateRoutes"]').uncheck();
    await group.locator('[name="roadAlternateSavingMetres"]').fill('250');
    await group.locator('[name="roadAlternateSavingFraction"]').fill('0.3');
    await group.locator('[name="roadAlternateParallelFraction"]').fill('0.1');
    await group.locator('[name="roadAlternateParallelDistance"]').fill('25');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.roadAlternateRoutes).toBe(false);
    // Recreate the original connected network locally to test the disabled state.
    w.roads = structuredClone(original);
    w.revision++;
    day();
    expect(w.roads).toEqual(original);
    expect(w.roadProject).toBeUndefined();
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="roadAlternateRoutes"]')).not.toBeChecked();
    for (const [key, value] of Object.entries({
      roadAlternateSavingMetres: '250',
      roadAlternateSavingFraction: '0.3',
      roadAlternateParallelFraction: '0.1',
      roadAlternateParallelDistance: '25',
    }))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(value);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidence + '/alternate-world-rules.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
