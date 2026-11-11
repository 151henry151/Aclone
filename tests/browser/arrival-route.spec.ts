// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { blocksBuilding } from '../../src/shared/building-shapes';
import { waitForWorld } from './fixtures/ready';

test('rear Ctrl entry walks around walls, exit keeps facing outward, and cancellation stays outside', async ({
  page,
}) => {
  test.setTimeout(150000);
  mkdirSync('output/arrival-route', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-arrival-route-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Village visitor');
    const initial = createWorld('arrival-route', 'A walk around the village shop', account.id);
    Object.assign(initial, {
      script: '',
      roads: [],
      towns: [],
      zones: [],
      resources: {},
      airfield: undefined,
      spaceportSite: undefined,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: -10,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      vehiclesPersist: true,
      arrivalAnimation: 'full',
      arrivalMinSeconds: 8,
      arrivalMaxSeconds: 8,
      respawnX: 300,
      respawnZ: 300,
    });
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { vehicle: 5, x: 0, z: -12, y: 0, heading: 0, speed: 0, engine: false });
    const shop = makeBuilding('shop', 'market', 0, 0);
    shop.name = 'Village shop';
    initial.buildings = [shop];
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const p = () => w().players[player.id];
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__arrivalScene=scene;\n',
      });
    });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'arrival-route');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.evaluate((id) => {
      (globalThis as any).__walkSamples = [];
      (globalThis as any).__walkTimer = setInterval(() => {
        const s = (globalThis as any).__arrivalScene,
          m = s?.meshes.get(id);
        if (m?.visible)
          (globalThis as any).__walkSamples.push({
            x: m.position.x,
            z: m.position.z,
            heading: m.rotation.y,
          });
      }, 30);
    }, player.id);
    await page.keyboard.press('Control');
    await expect.poll(() => p().task?.kind).toBe('entering');
    expect(p().task!.arrival!.path!.length).toBeGreaterThan(2);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => Math.abs((globalThis as any).__arrivalScene.meshes.get(id).position.x),
          player.id,
        ),
      )
      .toBeGreaterThan(3);
    await page.screenshot({ path: 'output/arrival-route/around-the-shop.png' });
    await expect.poll(() => p().inside, { timeout: 15000 }).toBe(shop.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    const samples = await page.evaluate(
      () => (globalThis as any).__walkSamples as { x: number; z: number; heading: number }[],
    );
    expect(samples.length).toBeGreaterThan(20);
    for (const pos of samples)
      expect(blocksBuilding(shop, pos.x, pos.z, 0, 0), JSON.stringify(pos)).toBe(false);
    await page.keyboard.press('Escape');
    await expect.poll(() => p().task?.kind).toBe('exiting');
    await expect.poll(() => p().task, { timeout: 15000 }).toBeUndefined();
    expect(p().heading).toBeCloseTo(0, 8);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => (globalThis as any).__arrivalScene.meshes.get(id).rotation.y,
          player.id,
        ),
      )
      .toBeCloseTo(0, 5);
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const s = (globalThis as any).__arrivalScene;
          const m = s.meshes.get(id);
          return (
            m.visible &&
            Number.isFinite(s.camera.position.y) &&
            (s.camera.position.z > 4 || s.camera.position.y > 5)
          );
        }, player.id),
      )
      .toBe(true);
    await page.screenshot({ path: 'output/arrival-route/facing-away-after-exit.png' });
    const z = p().z;
    await page.keyboard.down('w');
    await expect.poll(() => p().z).toBeGreaterThan(z + 1);
    await page.keyboard.up('w');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const clearance = page.getByRole('spinbutton', {
      name: 'Arrival pedestrian wall clearance (metres)',
      exact: true,
    });
    await expect(clearance).toHaveValue('0.45');
    await clearance.fill('0.8');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.arrivalWallClearance).toBe(0.8);
    await page.keyboard.press('Escape');
    Object.assign(p(), { x: 0, z: -12, y: 0, heading: 0, speed: 0 });
    w().revision++;
    await page.waitForTimeout(700);
    await page.keyboard.press('Control');
    await expect.poll(() => p().task?.kind).toBe('entering');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await expect.poll(() => p().task?.kind).toBe('exiting');
    await expect.poll(() => p().task, { timeout: 15000 }).toBeUndefined();
    expect(p().inside).toBeUndefined();
    expect(blocksBuilding(shop, p().x, p().z, 0, 0)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.evaluate(() => clearInterval((globalThis as any).__walkTimer)).catch(() => {});
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
