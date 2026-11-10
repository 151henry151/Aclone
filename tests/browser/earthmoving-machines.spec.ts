// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, makeBuilding, addPlayer, act } from '../../src/shared/simulation';
import { advanceManufacturing } from '../../src/shared/automotive-manufacturing';
import { automotiveConfig } from '../../src/shared/automotive-config';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('manufacture, purchase, qualify, fuel and drive both earthmovers with working implements and editable rules', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-plant-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const evidence = 'output/earthworks/machines';
  mkdirSync(evidence, { recursive: true });
  try {
    const { account, token } = app.universe.register('Plant operator');
    const w = createWorld('plant-browser', 'Plant workshop', account.id);
    w.script = '';
    w.towns = [];
    w.terrain = [];
    w.zones = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(20),
    };
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -40,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      activeWork: false,
      ownerOperation: true,
      arrivalAnimation: 'off',
      vehiclesPersist: true,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: 17,
      y: 20,
      heading: Math.PI,
      vehicle: 5,
      fleet: [0, 5],
      inventory: { fuel: 20 },
      cash: 30_000_000,
      authority: 20,
      skills: ['engineer'],
    });
    const b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
    b.owner = p.id;
    b.stock = {};
    b.investment = 1_000_000;
    w.buildings = [b];
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'normal');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__plantScene=scene;',
      });
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.locator('#target').click();
    const panel = page.locator('[data-manufacturing-panel]');
    await expect(panel).toContainText('No completed vehicles');
    await expect(
      panel.getByRole('button', { name: 'Queue Bulldozer', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: evidence + '/empty-factory.png' });
    for (const [product, slot] of [
      ['bulldozer', 38],
      ['backhoe', 39],
    ] as const) {
      if (slot === 39) {
        p.speed = 0;
        act(w, p.id, { type: 'vehicle', slot: 5 });
        Object.assign(p, { x: 0, z: 17, y: 20, heading: Math.PI });
        await expect(page.locator('#target')).toContainText('Automotive factory');
        await page.locator('#target').click();
      }
      const recipe = automotiveConfig(w).products[product];
      b.stock = { ...recipe.inputs };
      b.investment = 1_000_000;
      const queue = panel.getByRole('button', { name: 'Queue ' + recipe.name, exact: true });
      await expect(queue).toBeEnabled();
      await queue.click();
      await expect.poll(() => b.manufacturing?.orders.length).toBe(1);
      advanceManufacturing(
        w,
        w.time,
        w.time + recipe.seconds * automotiveConfig(w).factory.idealEmployees,
      );
      const buy = panel.getByRole('button', { name: 'Buy ' + recipe.name, exact: true });
      await expect(buy).toBeEnabled();
      await buy.click();
      await expect.poll(() => p.fleet?.includes(slot)).toBe(true);
      await page.keyboard.press('Escape');
      const parked = w.parkedVehicles![p.id + ':' + slot];
      Object.assign(p, { x: parked.x + 2, z: parked.z, heading: 0 });
      await expect(page.locator('#parked-status')).toContainText(recipe.name);
      if (slot === 38) {
        await expect(page.locator('#parked-status')).toContainText('plant operator');
        await expect(
          page
            .locator('#parked-status')
            .getByRole('button', { name: 'Get in ' + recipe.name, exact: true }),
        ).toBeDisabled();
        await page.screenshot({ path: evidence + '/qualification-required.png' });
        p.skills.push('plant operator');
      }
      await page
        .locator('#parked-status')
        .getByRole('button', { name: 'Get in ' + recipe.name, exact: true })
        .click();
      await expect.poll(() => p.vehicle).toBe(slot);
      await expect(page.locator('#driving')).toContainText(recipe.name);
      expect(p.fuel).toBe(0);
      await page.keyboard.down('w');
      await page.waitForTimeout(300);
      await page.keyboard.up('w');
      expect(p.speed).toBe(0);
      await page.keyboard.press('i');
      await page.getByRole('button', { name: 'Refuel', exact: true }).click();
      await expect.poll(() => p.fuel).toBeGreaterThan(0);
      const implement = page.locator('[data-earthmoving-controls]');
      await expect(implement).toContainText(recipe.name);
      await implement.getByRole('button', { name: 'Lower implement (G)', exact: true }).click();
      await expect.poll(() => p.earthmovingImplement).toBe(true);
      await expect(
        implement.getByRole('button', { name: 'Raise implement (G)', exact: true }),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      if (!p.engine) await page.keyboard.press('F4');
      await expect.poll(() => p.engine).toBe(true);
      await page.keyboard.down('w');
      await page.waitForTimeout(1800);
      await page.keyboard.up('w');
      await expect.poll(() => Math.abs(p.speed)).toBeGreaterThan(0.1);
      await page.evaluate(() => {
        const s = (window as any).__plantScene;
        s.orbit = 0.7;
        s.zoom = 1.25;
      });
      await page.waitForTimeout(500);
      const blocked = await page.evaluate(async () => {
        const url = '/node_modules/three/build/three.module.js',
          T = await import(url),
          s = (window as any).__plantScene;
        const ray = new T.Ray(
            s.target.clone(),
            s.camera.position.clone().sub(s.target).normalize(),
          ),
          reach = s.camera.position.distanceTo(s.target);
        return s.buildingMeshes
          .filter((g: any) => g.userData.building === 'assembly')
          .some((g: any) => {
            const bounds = new T.Box3().setFromObject(g);
            if (bounds.containsPoint(s.target)) return false;
            const hit = ray.intersectBox(bounds, new T.Vector3());
            return !!hit && hit.distanceTo(s.target) < reach;
          });
      });
      expect(blocked, 'factory must not hide the collected machine from its chase camera').toBe(
        false,
      );
      await page.screenshot({ path: evidence + '/' + product + '-working.png' });
      const geometry = await page.evaluate((id) => {
        const s = (window as any).__plantScene,
          m = s.meshes.get(id);
        return {
          name: m?.userData.earthmovingAnimate ? 'plant' : 'missing',
          calls: s.renderer.info.render.calls,
          driver: !!m?.userData.driver,
        };
      }, p.id);
      expect(geometry.name).toBe('plant');
      expect(geometry.driver).toBe(true);
      await page.keyboard.press('g');
      await expect.poll(() => p.earthmovingImplement).toBe(false);
      await page.keyboard.press('c');
      await page.waitForTimeout(500);
      await page.screenshot({ path: evidence + '/' + product + '-cab.png' });
      await page.keyboard.press('c');
      await page.keyboard.press('c');
      await page.evaluate(() => {
        const s = (window as any).__plantScene;
        s.orbit = -1.8;
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: evidence + '/' + product + '-rear.png' });
      w.settings.time = 0;
      if (!p.lights) await page.keyboard.press('l');
      await expect.poll(() => p.lights).toBe(true);
      await expect
        .poll(() =>
          page.evaluate((id) => {
            const root = (window as any).__plantScene.meshes.get(id),
              lamps = root?.userData.switchableLamps;
            return (
              !!lamps?.length &&
              lamps.every((m: any) => m.emissiveIntensity > 0 && m.emissive.getHex() !== 0)
            );
          }, p.id),
        )
        .toBe(true);
      await page.waitForTimeout(500);
      await page.screenshot({ path: evidence + '/' + product + '-night.png' });
      await page.keyboard.press('l');
      await expect.poll(() => p.lights).toBe(false);
      await expect
        .poll(() =>
          page.evaluate(
            (id) =>
              (window as any).__plantScene.meshes
                .get(id)
                ?.userData.switchableLamps?.every((m: any) => m.emissiveIntensity === 0),
            p.id,
          ),
        )
        .toBe(true);
      w.settings.time = 43200;
    }
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    const editor = page.locator('[data-vehicle-editor]');
    await editor.locator('[name="slot"]').selectOption('38');
    await editor.getByText('Performance, fuel and economy', { exact: true }).click();
    await editor.locator('[name="offRoadSpeed"]').fill('0.9');
    await editor.getByRole('button', { name: 'Save vehicle configuration', exact: true }).click();
    await expect.poll(() => w.vehicleTuning?.[38]?.offRoadSpeed).toBe(0.9);
    await page.keyboard.press('Escape');
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    await editor.locator('[name="slot"]').selectOption('38');
    await expect(editor.locator('[name="offRoadSpeed"]')).toHaveValue('0.9');
    expect(
      w.vehicleTuning?.[38]?.frontTrack,
      'editing speed must preserve the model track contacts',
    ).toBeUndefined();
    await page.screenshot({ path: evidence + '/world-builder.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
