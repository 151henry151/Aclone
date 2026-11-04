// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('fuel tanker shares the liquid body, with distinct paint, placards and rear dispensing hose empty and full', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__fuel-model', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}</style><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {createTrailer} from '/src/client/trailer-model.ts';
      import {trailerDefs} from '/src/shared/trailers.ts';
      const scene=new T.Scene();scene.background=new T.Color('#cedadc');scene.add(new T.HemisphereLight('#fff6df','#60705a',2));const sun=new T.DirectionalLight('#ffffff',3);sun.position.set(5,15,-8);scene.add(sun);
      const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#8c9676'}));ground.rotation.x=-Math.PI/2;scene.add(ground);
      const camera=new T.PerspectiveCamera(40,1440/900,.1,100);camera.position.set(8,5,-10);camera.lookAt(0,1.6,0);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      let model;
      window.show=(kind,cargo)=>{if(model)scene.remove(model);model=createTrailer(kind,cargo);scene.add(model);model.updateMatrixWorld(true);renderer.render(scene,camera);
        let paintedTop=0,rearHoseVertices=0;model.traverse(o=>{if(!o.isMesh)return;const material=o.material,positions=o.geometry.attributes.position;for(let i=0;i<positions.count;i++){const v=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);if(material.color?.getHexString()===trailerDefs[kind].color.slice(1))paintedTop=Math.max(paintedTop,v.y);if(material.color?.getHexString()==='25282a'&&v.z< -2.55&&v.y>1.1)rearHoseVertices++;}});
        return {paintedTop,rearHoseVertices,bounds:new T.Box3().setFromObject(model).getSize(new T.Vector3()).toArray()};};
      window.ready=true;
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__fuel-model');
    await page.waitForFunction(() => (window as any).ready);
    for (const [label, cargo] of [
      ['empty', {}],
      ['full', { fuel: 700 }],
    ] as const) {
      const shape = await page.evaluate((cargo) => (window as any).show('fuel', cargo), cargo);
      expect(shape.paintedTop, 'fuel tank is painted up to the cylindrical crown').toBeGreaterThan(
        2.9,
      );
      expect(shape.rearHoseVertices, 'rubber dispensing hose behind the tank').toBeGreaterThan(30);
      expect(shape.bounds[0]).toBeLessThan(2.8);
      expect(shape.bounds[1]).toBeGreaterThan(3);
      await page.screenshot({ path: `test-results/fuel-tanker-${label}.png` });
    }
    const liquid = await page.evaluate(() => (window as any).show('tanker', {}));
    expect(liquid.rearHoseVertices).toBe(0);
    await page.screenshot({ path: 'test-results/liquid-tanker-unchanged.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('garage purchase, refinery loading, parking and F10 tuning use the same fuel tanker capacity', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-fuel-trailer-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Fuel hauler');
    const w = createWorld('fuel-haulage', 'Fuel haulage', account.id);
    w.script = '';
    w.buildings = [];
    w.towns = [];
    w.roads = [];
    Object.assign(w.settings, {
      mapSize: 500,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      vehicleLicences: false,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: -40,
      y: 3,
      heading: 0,
      vehicle: 0,
      cash: 5000000,
      inventory: {},
      engine: false,
      speed: 0,
    });
    const garage = makeBuilding('garage', 'garage', 14, -40);
    w.buildings.push(garage);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'fuel-haulage');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    const tuning = page.locator('form[data-action="trailerTuning"]');
    await expect(tuning.locator('[name="priceDenarii"]')).toHaveValue('5750');
    await expect(tuning.locator('[name="capacity"]')).toHaveValue('700');
    await tuning.locator('[name="priceDenarii"]').fill('6000');
    await tuning.locator('[name="capacity"]').fill('800');
    await tuning.getByRole('button').click();
    await expect.poll(() => w.trailerTuning?.fuel?.capacity).toBe(800);
    // Switching vehicle slots must leave exactly one independent trailer editor.
    await page.locator('[data-vehicle-editor] [name="slot"]').selectOption('30');
    await expect(tuning).toHaveCount(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    const purchase = page
      .locator('form[data-action="trailer"]')
      .filter({ has: page.locator('[name="kind"][value="fuel"]') });
    await expect(purchase.locator('..')).toContainText('800 weight capacity');
    await purchase.getByRole('button').click();
    await expect.poll(() => Object.values(w.trailers ?? {}).length).toBe(1);
    const t = Object.values(w.trailers!)[0];
    expect(p.cash).toBe(4400000);
    expect(t.kind).toBe('fuel');
    await expect(page.getByText('0 / 800 weight', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/fuel-garage-empty.png' });
    await page.keyboard.press('Escape');
    garage.kind = 'refinery';
    garage.name = 'Fuel refinery';
    garage.stock = { fuel: 800 };
    garage.sell = { fuel: 3850 };
    garage.capacity = 1000;
    garage.investment = 0;
    garage.production = undefined;
    w.revision++;
    await page.keyboard.press('e');
    const buy = page
      .locator('form[data-action="trade"]')
      .filter({ has: page.locator('[name="storage"][value="trailer"]') })
      .filter({ has: page.locator('[name="direction"][value="buy"]') });
    await buy.locator('[name="item"]').selectOption('fuel');
    await buy.locator('[name="quantity"]').fill('800');
    await buy.getByRole('button').click();
    await expect.poll(() => t.cargo.fuel).toBe(800);
    await expect(page.getByText('800 / 800 weight', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/fuel-refinery-full.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    const unload = page
      .locator('form[data-action="trailer"]')
      .filter({ has: page.locator('[name="operation"][value="unload"]') });
    await unload.locator('[name="quantity"]').fill('10');
    await unload.getByRole('button').click();
    await expect.poll(() => p.inventory.fuel).toBe(10);
    await page.getByRole('button', { name: 'Unhitch here', exact: true }).click();
    await expect.poll(() => t.attached).toBeUndefined();
    await expect(page.getByText('790 / 800 weight', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/fuel-parked.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    await tuning.locator('[name="capacity"]').fill('700');
    await tuning.getByRole('button').click();
    await expect(
      page.getByText('Unload fuel tankers before reducing their capacity', { exact: true }),
    ).toBeVisible();
    expect(app.worlds.get(w.id)!.trailerTuning?.fuel?.capacity).toBe(800);
    await page.screenshot({ path: 'test-results/fuel-capacity-refused.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
