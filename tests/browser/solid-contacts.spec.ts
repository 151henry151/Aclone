// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { worldResources } from '../../src/shared/resources';
import { sceneryChunk } from '../../src/shared/scenery-obstacles';
import { waitForWorld } from './fixtures/ready';

test('owner configures contacts and drives into visible solids without damage', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-contacts-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Woodland driver');
  const w = createWorld('solid-browser', 'Woodland test yard', account.id);
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -10,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    parishOrders: false,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: true, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  const solids = [-1, 0].flatMap((x) => [-1, 0].flatMap((z) => sceneryChunk(w, x, z)));
  const tree = solids.find((o) => o.kind === 'tree' && o.species === 'oak' && o.z > 30)!;
  const rock = solids.find(
    (o) =>
      o.kind === 'boulder' &&
      o.source === 'village' &&
      worldResources(w).every((n) => Math.hypot(o.x - n.x, o.z - n.z) > 30),
  )!;
  expect(tree).toBeTruthy();
  expect(rock).toBeTruthy();
  const player = addPlayer(w, account.id, account.name);
  Object.assign(player, { x: tree.x, z: tree.z - 8, y: 20, heading: 0, engine: true, fuel: 64 });
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!;
  const p = () => current().players[player.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', {
      name: 'Solid scenery and vehicle contacts',
      exact: true,
    });
    await expect(group).toBeVisible({ timeout: 5000 });
    await expect(group.locator('[name="solidScenery"]')).toHaveValue('trunks-and-boulders');
    await group.locator('[name="vehicleCollision"]').selectOption('stop-only');
    await group.locator('[name="offlineVehicleObstacleSeconds"]').fill('0');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.vehicleCollision).toBe('stop-only');
    await expect(async () => {
      await group.scrollIntoViewIfNeeded();
    }).toPass({ timeout: 5000 });
    await page.screenshot({ path: 'output/solid-obstacles/browser/rules.png' });
    await group.locator('[name="vehicleGlancingDegrees"]').fill('46');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    expect(
      await group
        .locator('[name="vehicleGlancingDegrees"]')
        .evaluate(
          (input: HTMLInputElement) => input.validity.rangeOverflow && !!input.validationMessage,
        ),
    ).toBe(true);
    expect(current().settings.vehicleGlancingDegrees).toBe(15);
    await group.locator('[name="vehicleGlancingDegrees"]').fill('15');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    for (const o of [tree, rock]) {
      Object.assign(p(), {
        x: o.x,
        z: o.z - o.radius - 5,
        y: 20,
        heading: 0,
        speed: 0,
        vehicle: 0,
        engine: true,
      });
      await page.waitForTimeout(700);
      const start = p().z;
      await page.keyboard.down('w');
      await expect.poll(() => p().z).toBeGreaterThan(start + 0.5);
      await expect.poll(() => p().speed, { timeout: 15000 }).toBe(0);
      const stopped = p().z,
        fuel = p().fuel,
        health = p().health;
      await page.waitForTimeout(500);
      expect(p().z).toBeCloseTo(stopped, 4);
      expect(p().fuel).toBe(fuel);
      expect(p().health).toBe(health);
      await page.keyboard.up('w');
      await page.screenshot({ path: `output/solid-obstacles/browser/${o.kind}.png` });
    }
    // Real keyboard movement uses both server authority and client prediction.
    Object.assign(p(), { x: tree.x + 0.3, z: tree.z - 2, y: 20, vehicle: 5, heading: 0, speed: 0 });
    await page.waitForTimeout(700);
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(tree.z + 1);
    await page.keyboard.up('w');
    expect(p().x).toBeGreaterThan(tree.x + 0.3);
    await page.screenshot({ path: 'output/solid-obstacles/browser/walking-around.png' });

    Object.assign(p(), {
      x: tree.x,
      z: tree.z,
      y: 20,
      vehicle: 0,
      heading: 0,
      speed: 0,
      engine: true,
    });
    await page.waitForTimeout(700);
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(tree.z + tree.radius + 3);
    await page.keyboard.up('w');

    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    Object.assign(p(), { x: tree.x, z: tree.z, speed: 0, cash: 100000 });
    await page.waitForTimeout(700);
    await page.locator('[data-do="construction"]:visible').click();
    await page.getByLabel('Building type', { exact: true }).selectOption('home');
    await expect(page.locator('[data-build-estimate]')).toContainText(/tree|trunk/i);
    await expect(
      page.getByRole('button', { name: 'Place foundation', exact: true }),
    ).toBeDisabled();
    await page.locator('[data-build-estimate]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/solid-obstacles/browser/construction-blocked.png' });
    await close();

    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Layout', exact: true }).click();
    await page.getByLabel('Generated countryside trees and plants', { exact: true }).uncheck();
    await page.getByRole('button', { name: 'Save scenery', exact: true }).click();
    await expect.poll(() => current().creator?.scenery).toBe(false);
    await close();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'output/solid-obstacles/browser/empty-ground.png' });
    expect(sceneryChunk(current(), 0, 0)).toEqual([]);

    const neighbour = addPlayer(current(), 'neighbour', 'Neighbour');
    Object.assign(neighbour, { x: 80, z: 88, y: 20, heading: 0, speed: 0, online: true });
    const other = () => current().players[neighbour.id];
    Object.assign(p(), { x: 80, z: 80, y: 20, heading: 0, speed: 0, engine: true });
    await page.waitForTimeout(700);
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(80.5);
    await expect.poll(() => p().speed).toBe(0);
    await page.waitForTimeout(500);
    expect(p().z).toBeLessThan(84);
    expect({ x: other().x, z: other().z }).toEqual({ x: 80, z: 88 });
    await page.keyboard.up('w');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/solid-obstacles/browser/vehicle-contact.png' });
    // The zero timeout edited above removes a signed-off driver's obstruction.
    other().online = false;
    other().lastSeen = current().time;
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(90);
    await page.keyboard.up('w');

    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await group.locator('[name="vehicleCollision"]').selectOption('off');
    await group.locator('[name="solidScenery"]').selectOption('off');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.vehicleCollision).toBe('off');
    await close();
    other().online = true;
    Object.assign(p(), { x: 80, z: 80, heading: 0, speed: 0 });
    await page.waitForTimeout(700);
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(90);
    await page.keyboard.up('w');
    expect({ x: other().x, z: other().z }).toEqual({ x: 80, z: 88 });
    expect(errors).toEqual([]);
  } finally {
    await page.keyboard.up('w');
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
