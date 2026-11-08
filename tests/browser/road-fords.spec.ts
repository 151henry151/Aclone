// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { riverBanks } from '../../src/shared/inland-water';
import { terrainHeight } from '../../src/shared/terrain';
import { growRoads } from '../../src/shared/roads';
import { inlandBlocksGround } from '../../src/shared/inland-travel';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('drive a grown ford road and configure stricter crossing rules in World Builder', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-ford-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Ford driver');
  const w = createWorld('puddlewick', 'River road test', account.id);
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.towns = [];
  w.zones = [];
  w.script = '';
  w.terrain = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  delete w.airfield;
  delete w.spaceportSite;
  const river = w.northernIsland!.rivers[0],
    p = river.points[12],
    bank = riverBanks(river.points)[12];
  const dx = (bank.right.x - bank.left.x) / p.width,
    dz = (bank.right.z - bank.left.z) / p.width;
  const a = {
      x: p.x - (dx - 4 * dz) * (p.width / 2 + 12),
      z: p.z - (dz + 4 * dx) * (p.width / 2 + 12),
    },
    b = {
      x: p.x + (dx - 4 * dz) * (p.width / 2 + 12),
      z: p.z + (dz + 4 * dx) * (p.width / 2 + 12),
    };
  w.northernIsland!.rivers = [{ ...river, points: river.points.slice(8, 20) }];
  w.roads = [];
  w.roadProject = { kind: 'connection', width: 5, path: [a, b] };
  const end = w.settings.dayLength * 10,
    deadline = performance.now() + 10000;
  while ((w.roadGrowth ?? 0) < 10 && performance.now() < deadline) growRoads(w, 0, end);
  expect(w.roadGrowth).toBe(10);
  expect(w.roadProject).toBeUndefined();
  expect(w.roads.length).toBeGreaterThan(0);
  expect(inlandBlocksGround(w, a, b, 2.5)).toBe(false);
  Object.assign(w.settings, {
    dayLength: 0,
    time: 43200,
    hungerRate: 0,
    thirstRate: 0,
    oceanWaves: 0,
    arrivalAnimation: 'off',
  });
  const driver = addPlayer(w, account.id, account.name);
  const heading = Math.atan2(b.x - a.x, b.z - a.z),
    length = Math.hypot(b.x - a.x, b.z - a.z);
  Object.assign(driver, {
    ...a,
    y: terrainHeight(w, a.x, a.z),
    heading,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 24, 5],
    fuelVehicle: 24,
    fuel: 30,
    engine: true,
    speed: 0,
  });
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const progress = () => ((driver.x - a.x) * (b.x - a.x) + (driver.z - a.z) * (b.z - a.z)) / length;
  mkdirSync('output/roads-resume/browser', { recursive: true });
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
    await page.screenshot({ path: 'output/roads-resume/browser/ford-road-start.png' });
    await page.keyboard.down('w');
    try {
      await expect.poll(progress, { timeout: 45000 }).toBeGreaterThan(length - 8);
    } finally {
      await page.keyboard.up('w');
    }
    await page.keyboard.press('F4');
    expect(inlandBlocksGround(w, a, { x: driver.x, z: driver.z }, 2.5)).toBe(false);
    await page.screenshot({ path: 'output/roads-resume/browser/ford-road-crossed.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Roads and river crossings', exact: true });
    await expect(group.locator('[name="roadFords"]')).toBeChecked();
    await expect(group.locator('[name="groundWaterDepth"]')).toHaveValue('0.8');
    await group.locator('[name="roadFords"]').uncheck();
    await group.locator('[name="groundWaterDepth"]').fill('0.1');
    await group.locator('[name="roadGrowthPerDay"]').fill('0');
    await group.locator('[name="roadWidth"]').fill('8');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.groundWaterDepth).toBe(0.1);
    await expect.poll(() => w.settings.roadFords).toBe(false);
    expect(w.roads.length).toBeGreaterThan(0);
    // Reset this local test driver for the independently refused crossing.
    Object.assign(driver, { ...a, y: terrainHeight(w, a.x, a.z), heading, speed: 0, engine: true });
    w.revision++;
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.down('w');
    try {
      await page.waitForTimeout(12000);
    } finally {
      await page.keyboard.up('w');
    }
    expect(progress()).toBeLessThan(length / 2);
    expect(inlandBlocksGround(w, a, b, 2.5)).toBe(true);
    await page.keyboard.press('F4');
    await page.screenshot({ path: 'output/roads-resume/browser/ford-road-refused.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="roadFords"]')).not.toBeChecked();
    await expect(group.locator('[name="groundWaterDepth"]')).toHaveValue('0.1');
    await expect(group.locator('[name="roadGrowthPerDay"]')).toHaveValue('0');
    await expect(group.locator('[name="roadWidth"]')).toHaveValue('8');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/roads-resume/browser/ford-world-rules.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
