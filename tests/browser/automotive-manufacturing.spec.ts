// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, makeBuilding, addPlayer, act, advance } from '../../src/shared/simulation';
import { waitForWorld } from './fixtures/ready';
import { creatorSchema } from '../../src/shared/creator';
import { automotiveConfig } from '../../src/shared/automotive-config';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('inspect empty factory, fund and staff assembly, preserve progress and edit world manufacturing rules', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-automotive-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = JSON.parse(String(payload));
        if (message.type === 'result' && !message.ok)
          console.log('ACTION_REFUSAL', message.message);
      } catch {}
    }),
  );
  const evidence = 'output/automotive-factory/browser';
  mkdirSync(evidence, { recursive: true });
  try {
    const { account, token } = app.universe.register('Assembly founder');
    let w = createWorld('assembly-browser', 'Automotive workshop', account.id);
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
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      activeWork: false,
      arrivalAnimation: 'off',
      vehiclesPersist: true,
    });
    let p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: 17,
      y: 20,
      heading: Math.PI,
      vehicle: 5,
      fleet: [0, 5],
      inventory: { fuel: 2 },
      cash: 20_000_000,
      authority: 20,
      skills: ['driver'],
    });
    let b = makeBuilding('assembly', 'automotiveFactory', 0, 0);
    b.owner = p.id;
    b.stock = {};
    b.investment = 0;
    w.buildings = [b];
    app.worlds.set(w.id, w);
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
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__assemblyScene=scene;',
      });
    });
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await expect(page.locator('#target')).toContainText('Automotive factory');
    await page.locator('#target').click();
    const panel = page.locator('[data-manufacturing-panel]');
    await expect(panel.getByRole('heading', { name: 'Vehicle assembly' })).toBeVisible();
    await expect(panel).toContainText('No completed vehicles');
    await expect(panel).toContainText('120 Steel');
    await expect(
      panel.getByRole('button', { name: 'Queue Highway tractor unit', exact: true }),
    ).toBeDisabled();
    await page.screenshot({ path: evidence + '/empty-factory.png' });
    b.stock = { steel: 120, electronics: 8, tools: 8, wood: 20, fuel: 20 };
    await expect(panel).toContainText('Fund payroll');
    b.investment = 1_000_000;
    await expect(
      panel.getByRole('button', { name: 'Queue Highway tractor unit', exact: true }),
    ).toBeEnabled();
    await panel.getByRole('button', { name: 'Queue Highway tractor unit', exact: true }).click();
    await expect.poll(() => b.manufacturing?.orders.length).toBe(1);
    await expect(panel).toContainText('Waiting for qualified staff');
    for (let i = 0; i < 6; i++) {
      const q = addPlayer(w, 'worker-' + i, 'Engineer ' + i);
      Object.assign(q, { x: 0, z: 17, y: 20, skills: ['engineer'] });
      act(w, q.id, { type: 'job', building: b.id });
    }
    advance(w, 3600);
    await expect(panel).toContainText(/50%|51%/);
    await expect(panel).toContainText('Qualified crew working');
    await page.screenshot({ path: evidence + '/staffed-assembly.png' });
    advance(w, 3601);
    await expect(panel).toContainText('Ready: Highway tractor unit');
    // Complete each finite variant through its real owner control, then exercise full storage.
    for (const product of ['box', 'refrigerated', 'stake'] as const) {
      const recipe = automotiveConfig(w).products[product];
      b.stock = { ...recipe.inputs };
      b.investment = 1_000_000;
      const queueButton = panel.getByRole('button', { name: 'Queue ' + recipe.name, exact: true });
      await expect(queueButton).toBeEnabled();
      await queueButton.click();
      await expect.poll(() => b.manufacturing?.orders[0]?.product).toBe(product);
      advance(w, recipe.seconds + 1);
      await expect(panel).toContainText('Ready: ' + recipe.name);
    }
    await page.getByRole('button', { name: 'Statement', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('4 assembly orders completed');
    await expect(page.getByRole('dialog')).toContainText('1 Highway tractor unit');
    await expect(page.getByRole('dialog')).not.toContainText('automotive:tractor');
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await expect(panel).toContainText('Vehicle storage full');
    await expect(
      panel.getByRole('button', { name: 'Queue Highway tractor unit', exact: true }),
    ).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(panel.getByRole('heading', { name: 'Vehicle assembly' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
        })),
      )
      .toEqual({ width: 390, viewport: 390 });
    await page.screenshot({ path: evidence + '/mobile-assembly.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    const buyTruck = panel.getByRole('button', { name: 'Buy Highway tractor unit', exact: true });
    p.cash = 0;
    await expect(buyTruck).toBeDisabled();
    await expect(panel).toContainText('Not enough cash');
    p.cash = 20_000_000;
    await expect(buyTruck).toBeEnabled();
    // Actual blocked delivery must leave paid inventory and cash untouched.
    for (let x = -40; x <= 40; x += 8)
      for (let z = 16; z <= 70; z += 8)
        w.buildings.push(makeBuilding(`blocked-${x}-${z}`, 'garage', x, z));
    const cashBeforeRefusal = p.cash;
    await buyTruck.click();
    await expect(page.locator('body')).toContainText('No safe clear delivery place');
    // Failed actions restore the server checkpoint, replacing object identities.
    w = app.worlds.get(w.id)!;
    p = w.players[account.id];
    b = w.buildings.find((building) => building.id === 'assembly')!;
    expect(p.cash).toBe(cashBeforeRefusal);
    expect(p.fleet?.includes(37)).toBe(false);
    expect(b.manufacturing?.ready.some((v) => v.product === 'tractor')).toBe(true);
    await page.screenshot({ path: evidence + '/blocked-delivery.png' });
    w.buildings = [b];
    await buyTruck.click();
    await expect.poll(() => p.fleet?.includes(37)).toBe(true);
    await expect(panel).not.toContainText('Ready: Highway tractor unit');
    for (const product of ['box', 'refrigerated', 'stake'] as const) {
      await panel
        .getByRole('button', {
          name: 'Buy ' + automotiveConfig(w).products[product].name,
          exact: true,
        })
        .click();
      await expect
        .poll(() => b.manufacturing?.ready.some((v) => v.product === product))
        .toBe(false);
    }
    await expect(panel).toContainText('No completed vehicles');
    expect(Object.values(w.trailers ?? {}).filter((t) => t.owner === p.id)).toHaveLength(3);
    await page.screenshot({ path: evidence + '/collected-inventory.png' });
    // Manufacture actual extra units before exercising finite external collection.
    for (const product of ['box', 'stake'] as const) {
      const recipe = automotiveConfig(w).products[product];
      b.stock = { ...recipe.inputs };
      b.investment = 1_000_000;
      await panel.getByRole('button', { name: 'Queue ' + recipe.name, exact: true }).click();
      await expect.poll(() => b.manufacturing?.orders[0]?.product).toBe(product);
      advance(w, recipe.seconds + 1);
      await expect(panel).toContainText('Ready: ' + recipe.name);
    }
    const investment = b.investment;
    await panel.getByRole('button', { name: 'Export Box semitrailer', exact: true }).click();
    await expect.poll(() => b.manufacturing?.ready.length).toBe(1);
    expect(b.investment).toBeGreaterThan(investment);
    await expect(panel).toContainText('0 collection places available');
    await expect(
      panel.getByRole('button', { name: 'Export Stake semitrailer', exact: true }),
    ).toBeDisabled();
    await expect(async () => {
      await panel.getByText('External vehicle buyers', { exact: true }).scrollIntoViewIfNeeded();
    }).toPass({ timeout: 5000 });
    await page.screenshot({ path: evidence + '/limited-exports.png' });
    await page.keyboard.press('Escape');
    const delivered = w.parkedVehicles![`${p.id}:37`];
    Object.assign(p, { x: delivered.x + 2, z: delivered.z, heading: 0 });
    await expect(page.locator('#parked-status')).toContainText('Highway tractor unit');
    await page
      .locator('#parked-status')
      .getByRole('button', { name: 'Board vehicle', exact: true })
      .click();
    await expect.poll(() => p.vehicle).toBe(37);
    await expect(page.locator('#driving')).toContainText('Highway tractor unit');
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Refuel', exact: true }).click();
    await expect.poll(() => p.fuel).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F4');
    await expect.poll(() => p.engine).toBe(true);
    await page.waitForTimeout(1500);
    const obstruction = await page.evaluate(async () => {
      const url = '/node_modules/three/build/three.module.js';
      const T = await import(url),
        scene = (window as any).__assemblyScene;
      const obstacles = [
        ...scene.buildingMeshes.filter((g: any) => g.userData.building === 'assembly'),
        ...scene.trailers.group.children,
        ...[...scene.parkedVehicles.models.values()].map((entry: any) => entry.model),
      ];
      const direction = scene.camera.position.clone().sub(scene.target),
        reach = direction.length();
      const ray = new T.Ray(scene.target.clone(), direction.normalize());
      return obstacles.flatMap((model: any) => {
        const bounds = new T.Box3();
        model.updateWorldMatrix(true, true);
        model.traverse((part: any) => {
          if (!part.isMesh || !part.visible) return;
          part.geometry.computeBoundingBox();
          bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
        });
        if (bounds.containsPoint(scene.target)) return [];
        const hit = ray.intersectBox(bounds, new T.Vector3());
        return hit && hit.distanceTo(scene.target) < reach
          ? [model.name || model.userData.building || model.uuid]
          : [];
      });
    });
    expect(
      obstruction,
      'Collected truck chase camera must see past the factory and delivered trailers',
    ).toEqual([]);
    await page.evaluate(async (playerId) => {
      const url = '/node_modules/three/build/three.module.js';
      const T = await import(url),
        scene = (window as any).__assemblyScene;
      (window as any).__factoryCamera = [];
      (window as any).__factoryCameraTimer = setInterval(() => {
        const models = [
          ...scene.buildingMeshes.filter((g: any) => g.userData.building === 'assembly'),
          ...scene.trailers.group.children,
        ];
        for (const model of models) {
          const bounds = new T.Box3();
          model.updateWorldMatrix(true, true);
          model.traverse((part: any) => {
            if (!part.isMesh || !part.visible) return;
            part.geometry.computeBoundingBox();
            bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
          });
          if (model.userData.building === 'assembly') {
            const truck = scene.meshes.get(playerId);
            truck?.updateWorldMatrix(true, true);
            for (const wheel of truck?.userData.wheels ?? []) {
              const origin = wheel.getWorldPosition(new T.Vector3());
              const direction = scene.camera.position.clone().sub(origin);
              const reach = direction.length();
              const ray = new T.Ray(origin, direction.normalize());
              model.traverse((part: any) => {
                if (!part.isMesh || !part.visible) return;
                const solid = part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld);
                const hit = ray.intersectBox(solid, new T.Vector3());
                if (hit && hit.distanceTo(origin) < reach)
                  (window as any).__factoryCamera.push({
                    reason: 'factory hides a truck wheel',
                    wheel: origin.toArray(),
                    camera: scene.camera.position.toArray(),
                  });
              });
            }
          }
          if (bounds.containsPoint(scene.camera.position))
            (window as any).__factoryCamera.push({
              name: model.name || model.userData.building,
              camera: scene.camera.position.toArray(),
              target: scene.target.toArray(),
              min: bounds.min.toArray(),
              max: bounds.max.toArray(),
            });
        }
      }, 100);
    }, p.id);
    const collectedAt = { x: p.x, z: p.z };
    await page.keyboard.down('w');
    await expect
      .poll(() => Math.hypot(p.x - collectedAt.x, p.z - collectedAt.z), { timeout: 25000 })
      .toBeGreaterThan(20);
    await page.keyboard.up('w');
    const occludedFrames = await page.evaluate(() => {
      clearInterval((window as any).__factoryCameraTimer);
      return (window as any).__factoryCamera;
    });
    console.log('COLLECTION_CAMERA', JSON.stringify(occludedFrames.slice(0, 3)));
    expect(
      occludedFrames,
      'Camera must stay outside the factory and delivered trailers throughout collection driving',
    ).toEqual([]);
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.1);
    await page.waitForTimeout(750);
    await page.mouse.move(750, 450);
    await page.mouse.down();
    await page.mouse.move(1050, 450, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(750);
    await page.screenshot({ path: evidence + '/highway-tractor-exterior.png' });
    await page.mouse.move(1050, 450);
    await page.mouse.down();
    await page.mouse.move(750, 450, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.press('c');
    await page.waitForTimeout(750);
    await page.screenshot({ path: evidence + '/highway-tractor-cab.png' });
    await page.keyboard.press('c');
    act(w, p.id, { type: 'vehicle', slot: 5 });
    const reefer = Object.values(w.trailers!).find((t) => t.kind === 'semiRefrigerated')!;
    Object.assign(p, { x: reefer.x + 3, z: reefer.z, speed: 0 });
    await page.keyboard.press('i');
    const cooling = page.locator('section.notice').filter({
      has: page.getByRole('heading', { name: 'Refrigerated semitrailer', exact: true }),
    });
    await expect(
      cooling.getByRole('button', { name: 'Start refrigeration', exact: true }),
    ).toBeDisabled();
    await expect(cooling).toContainText('Add refrigeration fuel first');
    await cooling.getByRole('button', { name: 'Refuel refrigeration', exact: true }).click();
    await expect.poll(() => reefer.cooling?.fuel ?? 0).toBeGreaterThan(0);
    await cooling.getByRole('button', { name: 'Start refrigeration', exact: true }).click();
    await expect.poll(() => reefer.cooling?.running).toBe(true);
    await expect(cooling).toContainText('Cooling');
    await page.screenshot({ path: evidence + '/powered-refrigeration.png' });
    await cooling.getByRole('button', { name: 'Stop refrigeration', exact: true }).click();
    await expect.poll(() => reefer.cooling?.running).toBe(false);
    await page.keyboard.press('Escape');
    const stake = Object.values(w.trailers!).find((t) => t.kind === 'semiStake')!;
    Object.assign(p, { x: stake.x + 3, z: stake.z, speed: 0 });
    p.inventory.wood = 20;
    await page.keyboard.press('i');
    const timber = page.locator('section.notice').filter({
      has: page.getByRole('heading', { name: 'Stake semitrailer', exact: true }),
    });
    const load = timber
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Load', exact: true }) });
    await load.locator('select[name="item"]').selectOption('wood');
    await load.getByLabel('Quantity', { exact: true }).fill('20');
    await load.getByRole('button', { name: 'Load', exact: true }).click();
    await expect.poll(() => stake.cargo.wood).toBe(20);
    await page.keyboard.press('Escape');
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const models = (window as any).__assemblyScene.trailers.group.children;
          return models.some(
            (model: any) => model.getObjectByName('timber-load')?.children.length > 0,
          );
        }, stake.id),
      )
      .toBe(true);
    await page.screenshot({ path: evidence + '/timber-load.png' });
    // Pull back for the real hall frontage after closing the nearby-work panel.
    p.x = 0;
    p.z = 48;
    p.heading = Math.PI;
    await page.keyboard.press('c');
    await expect(page.locator('#target')).not.toContainText('Automotive factory');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: evidence + '/assembly-hall.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Automotive industry', exact: true }).click();
    const factory = page.locator('#creator-automotive-factory-form');
    await factory.getByLabel('Ready and reserved vehicle limit').fill('2');
    await factory.getByRole('button', { name: 'Save factory rules', exact: true }).click();
    await expect.poll(() => w.automotive?.factory.readyCapacity).toBe(2);
    const tractor = page.locator('#creator-automotive-tractor-form');
    await tractor.getByLabel('Fully staffed assembly seconds').fill('9000');
    await tractor.getByRole('button', { name: 'Save Highway tractor unit', exact: true }).click();
    await expect.poll(() => w.automotive?.products.tractor.seconds).toBe(9000);
    await page.screenshot({ path: evidence + '/world-manufacturing-rules.png' });
    const exports = page.locator('#creator-automotive-exports-form');
    await exports
      .getByLabel('Seconds per external collection place', { exact: true })
      .fill('43200');
    await exports.getByLabel('World-wide external collection places', { exact: true }).fill('2');
    await exports
      .getByLabel('External price fraction of world catalogue', { exact: true })
      .fill('0.7');
    await exports.getByRole('button', { name: 'Save export rules', exact: true }).click();
    await expect.poll(() => w.automotive?.exports.priceFraction).toBe(0.7);
    await expect.poll(() => w.automotive?.exports.units).toBe(2);
    const driving = page.locator('#creator-automotive-driving-form');
    await expect(driving).toBeVisible();
    await driving.getByLabel('Off-road maximum speed (m/s)', { exact: true }).fill('2');
    await driving
      .getByLabel('Maximum terrain rise per horizontal metre', { exact: true })
      .fill('0.75');
    await driving
      .getByLabel('Additional suspension clearance (metres)', { exact: true })
      .fill('0.6');
    await driving.getByRole('button', { name: 'Save highway driving rules', exact: true }).click();
    await expect.poll(() => w.automotive?.driving.offRoadSpeed).toBe(2);
    await expect.poll(() => w.automotive?.driving.maximumTerrainGrade).toBe(0.75);
    await expect.poll(() => w.automotive?.driving.suspensionTravel).toBe(0.6);
    const parkedId = `${p.id}:37`;
    const parkedBefore = await page.evaluate(
      (id) => (window as any).__assemblyScene.parkedVehicles.models.get(id)?.model.uuid,
      parkedId,
    );
    expect(parkedBefore).toBeTruthy();
    const coupling = page.locator('#creator-automotive-coupling-form');
    await coupling.getByLabel('Fifth wheel Z (metres)', { exact: true }).fill('-1.6');
    await coupling.getByRole('button', { name: 'Save coupling dimensions', exact: true }).click();
    await expect.poll(() => w.automotive?.coupling.fifthWheelZ).toBe(-1.6);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => (window as any).__assemblyScene.parkedVehicles.models.get(id)?.model.uuid,
          parkedId,
        ),
      )
      .not.toBe(parkedBefore);
    const refrigeration = page.locator('#creator-automotive-refrigeration-form');
    await refrigeration.getByLabel('Powered raw-meat ageing fraction', { exact: true }).fill('0.3');
    await refrigeration
      .getByRole('button', { name: 'Save refrigeration rules', exact: true })
      .click();
    await expect.poll(() => w.automotive?.refrigeration.ageingMultiplier).toBe(0.3);
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    const vehicle = page.locator('[data-vehicle-editor]');
    await vehicle.locator('[name="slot"]').selectOption('37');
    await vehicle.getByText('Performance, fuel and economy', { exact: true }).click();
    await vehicle.locator('[name="speed"]').fill('25');
    await vehicle.locator('[name="height"]').fill('4.5');
    await expect(vehicle.locator('[name="name"]')).toHaveCount(0);
    await expect(vehicle.locator('[name="mode"] option')).toHaveCount(2);
    await vehicle.getByRole('button', { name: 'Save vehicle configuration' }).click();
    await expect.poll(() => w.vehicleTuning?.[37]?.speed).toBe(25);
    await expect.poll(() => w.vehicleTuning?.[37]?.height).toBe(4.5);
    await expect
      .poll(() =>
        page.evaluate(
          (id) => (window as any).__assemblyScene.parkedVehicles.models.get(id)?.bounds.max.y,
          parkedId,
        ),
      )
      .toBeCloseTo(4.5, 2);
    await page.keyboard.press('Escape');
    const parked = w.parkedVehicles![parkedId];
    Object.assign(p, { x: parked.x + 2, z: parked.z });
    await expect(page.locator('#parked-status')).toContainText('Highway tractor unit');
    await page
      .locator('#parked-status')
      .getByRole('button', { name: 'Board vehicle', exact: true })
      .click();
    await expect.poll(() => p.vehicle).toBe(37);
    await page.waitForTimeout(500);
    const activeBefore = await page.evaluate(
      (id) => (window as any).__assemblyScene.meshes.get(id)?.uuid,
      p.id,
    );
    expect(activeBefore).toBeTruthy();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Automotive industry', exact: true }).click();
    await coupling.getByLabel('Fifth wheel Z (metres)', { exact: true }).fill('-1.7');
    await coupling.getByRole('button', { name: 'Save coupling dimensions', exact: true }).click();
    await expect.poll(() => w.automotive?.coupling.fifthWheelZ).toBe(-1.7);
    await expect
      .poll(() => page.evaluate((id) => (window as any).__assemblyScene.meshes.get(id)?.uuid, p.id))
      .not.toBe(activeBefore);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(750);
    await page.screenshot({ path: evidence + '/custom-height-tractor.png' });

    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
