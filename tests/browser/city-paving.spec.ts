// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { landscapeSchema } from '../../src/shared/landscape';
import { growRoads } from '../../src/shared/roads';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('watch a city pave dense streets, retain a dirt farm lane, drive and configure the policy', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-city-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('City driver'),
    w = createWorld('city-browser', 'Growing city', account.id);
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
    dayLength: 600,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
    roadGrowthPerDay: 0,
    cityPaving: true,
    cityBuildings: 4,
    cityBusinesses: 2,
    cityResidents: 1,
    cityQualificationDays: 2,
    cityDensityDays: 2,
    cityDensityBuildings: 4,
    cityDensityRadius: 60,
    cityDensitySampleSpacing: 10,
    cityPavingPerDay: 10,
  });
  w.towns = [
    {
      ...w.towns[0],
      id: 'city',
      name: 'Growing city',
      x: 0,
      z: 0,
      radius: 200,
      residents: [account.id],
    },
  ];
  w.roads = [
    { a: { x: 0, z: 0 }, b: { x: 180, z: 0 }, width: 6 },
    { a: { x: 0, z: 0 }, b: { x: 0, z: -180 }, width: 5 },
  ];
  for (const [i, x] of [0, 35, 70, 105, 140].entries())
    for (const z of [-30, 30]) {
      const b = makeBuilding(
        `street-${x}-${z}`,
        ['market', 'pub', 'bakery', 'bank', 'teaHouse'][i],
        x,
        z,
      );
      b.owner = account.id;
      b.government = false;
      w.buildings.push(b);
    }
  const farm = makeBuilding('farm', 'farm', 30, -160);
  farm.owner = account.id;
  farm.government = false;
  w.buildings.push(farm);
  const driver = addPlayer(w, account.id, account.name);
  Object.assign(driver, {
    x: -10,
    z: 0,
    y: 10,
    heading: Math.PI / 2,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 24],
    fuelVehicle: 24,
    fuel: 40,
    engine: true,
    speed: 0,
  });
  app.worlds.set(w.id, w);
  const evidence = 'output/city-paving/browser';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const day = () => {
    const start = w.time;
    w.time += 600;
    growRoads(w, start, w.time);
    const deadline = performance.now() + 10000;
    while (w.pavingDue !== undefined && performance.now() < deadline) growRoads(w, w.time, w.time);
    expect(w.pavingDue).toBeUndefined();
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
    const pavement = map.locator('[data-paved-road]');
    day();
    expect(w.cityDevelopment?.city.qualified).toBe(false);
    await expect(pavement).toHaveCount(0);
    await page.screenshot({ path: evidence + '/town-before-qualification.png' });
    await page.keyboard.press('m');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    const government = page.getByRole('dialog', { name: 'Build something useful.', exact: true });
    await expect(government).toContainText('City qualification:');
    await expect(government).toContainText('1/2 sustained game days');
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    const terrain = map.locator('.map-terrain');
    await expect(terrain).toHaveAttribute('data-rendered-job', /[0-9]+/);
    const terrainJob = await terrain.getAttribute('data-rendered-job'),
      viewport = map.locator('.parish-map-viewport'),
      scroll = await viewport.evaluate((el) => [el.scrollLeft, el.scrollTop]);
    const zoom = map.getByRole('button', { name: 'Zoom in', exact: true });
    await zoom.focus();
    day();
    expect(w.cityDevelopment?.city.qualified).toBe(true);
    expect(w.pavedRoads?.length).toBeGreaterThan(0);
    // A horizontal SVG path has zero geometric height even when its stroke is
    // painted. Verify the painted stroke and its screen position, not that box.
    await expect(pavement.first()).toHaveAttribute('stroke', '#818a8c');
    expect(
      await pavement.first().evaluate((el) => {
        const path = el as SVGPathElement,
          box = path.getBoundingClientRect();
        return (
          path.getTotalLength() > 0 &&
          Number(getComputedStyle(path).strokeWidth.replace('px', '')) > 0 &&
          box.right > 0 &&
          box.left < innerWidth &&
          box.top > 0 &&
          box.top < innerHeight
        );
      }),
    ).toBe(true);
    expect(await map.textContent()).toContain('City of Growing city');
    await expect(terrain).toHaveAttribute('data-rendered-job', terrainJob!);
    await expect(zoom).toBeFocused();
    expect(await viewport.evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual(scroll);
    await page.screenshot({ path: evidence + '/city-first-pavement.png' });
    for (let i = 0; i < 14; i++) day();
    expect(w.pavedRoads!.some((r) => r.b.x >= 140)).toBe(true);
    expect(w.pavedRoads!.every((r) => Math.min(r.a.z, r.b.z) > -100)).toBe(true);
    await page.screenshot({ path: evidence + '/city-and-dirt-farm-lane.png' });
    await page.keyboard.press('m');
    await expect(map).not.toBeVisible();
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await expect(government).toContainText('City status established');
    await government
      .getByRole('heading', { name: 'City of Growing city', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: evidence + '/city-government.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: evidence + '/paved-street-ground.png' });
    await page.keyboard.down('w');
    try {
      await expect.poll(() => driver.x, { timeout: 30000 }).toBeGreaterThan(110);
    } finally {
      await page.keyboard.up('w');
    }
    await page.keyboard.press('F4');
    await page.screenshot({ path: evidence + '/drive-the-paved-street.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Roads and river crossings', exact: true });
    await group.locator('[name="cityPaving"]').uncheck();
    await group.locator('[name="cityPavingPerDay"]').fill('0.5');
    await group.locator('[name="cityBuildings"]').fill('95');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.cityPaving).toBe(false);
    const previous = JSON.stringify(w.pavedRoads);
    day();
    expect(JSON.stringify(w.pavedRoads)).toBe(previous);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="cityPaving"]')).not.toBeChecked();
    await expect(group.locator('[name="cityPavingPerDay"]')).toHaveValue('0.5');
    await expect(group.locator('[name="cityBuildings"]')).toHaveValue('95');
    await page.screenshot({ path: evidence + '/saved-city-policy.png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('show a real river-bank paved approach waiting for a bridge with separate dirt ford access', async ({
  page,
}) => {
  test.setTimeout(240000);
  const { preparedRiverApproach } = await import('../fixtures/city-river');
  const { terrainHeight } = await import('../../src/shared/terrain');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-city-bank-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('River driver'),
    w = preparedRiverApproach();
  w.id = 'city-bank-browser';
  w.name = 'River approaches';
  w.owner = account.id;
  w.script = '';
  Object.assign(w.settings, {
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
  });
  w.creator!.weather = 'clear';
  const { near, far } = w.pavingProjects![w.towns[0].id].waitingForBridge!,
    heading = Math.atan2(far.x - near.x, far.z - near.z);
  const driver = addPlayer(w, account.id, account.name);
  Object.assign(driver, {
    x: near.x - Math.sin(heading) * 20,
    z: near.z - Math.cos(heading) * 20,
    heading,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 24],
    fuelVehicle: 24,
    fuel: 40,
    engine: false,
    speed: 0,
  });
  driver.y = terrainHeight(w, driver.x, driver.z);
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
    await page.screenshot({ path: 'output/city-paving/browser/river-bank-ground.png' });
    await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
    await expect(map).toBeVisible();
    await expect(map.locator('[data-paving-bank]').first()).toBeVisible();
    await expect(map).toContainText('Bridge needed');
    await expect(map.locator('.map-terrain')).toHaveAttribute('data-rendered-job', /[0-9]+/, {
      timeout: 60000,
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'output/city-paving/browser/river-bank-map.png' });
    expect(w.pavingFeeders!.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
