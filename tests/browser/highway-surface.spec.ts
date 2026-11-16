// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('drive a highway rig off pavement, slow progressively, and accelerate onto the next road', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-road-transition-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Road test driver');
    const w = createWorld('road-transition', 'Highway field crossing', account.id);
    w.script = '';
    w.buildings = [];
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
      mapSize: 1000,
      seaLevel: -50,
      hungerRate: 0,
      thirstRate: 0,
      vehicleMaintenance: false,
      dayLength: 0,
      time: 43200,
    });
    w.roads = [
      { a: { x: 0, z: -400 }, b: { x: 0, z: 0 }, width: 8 },
      { a: { x: 0, z: 70 }, b: { x: 0, z: 400 }, width: 8 },
    ];
    w.pavedRoads = w.roads.map((r) => ({
      ...structuredClone(r),
      town: '',
      kind: 'trunk' as const,
    }));
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: -1,
      y: 20,
      heading: 0,
      vehicle: 37,
      fleet: [0, 5, 37],
      fuel: 160,
      fuelVehicle: 37,
      engine: true,
      inventory: {},
      skills: ['driver'],
      fleetState: { 37: { condition: 100 } },
    });
    const t = {
      id: 'box',
      owner: p.id,
      kind: 'semiBox' as const,
      x: 0,
      z: -8.1,
      heading: 0,
      cargo: { wood: 20 },
      attached: p.id,
    };
    w.trailers = { box: t };
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.goto(`http://127.0.0.1:${await app.listen()}`);
    await waitForWorld(page);
    await page.keyboard.down('w');
    await expect.poll(() => p.speed).toBeGreaterThan(0.1);
    p.speed = 17.8816;
    await expect.poll(() => p.z, { intervals: [20] }).toBeGreaterThan(1);
    expect(p.speed).toBeGreaterThan(15);
    expect(p.speed).toBeLessThan(18);
    await expect.poll(() => p.speed, { intervals: [50] }).toBeLessThanOrEqual(5.41);
    expect(p.speed).toBeGreaterThan(5);
    expect(p.z).toBeLessThan(65);
    await page.keyboard.press('c');
    mkdirSync('output/highway-rework', { recursive: true });
    await page.screenshot({ path: 'output/highway-rework/field-cab.png' });
    await expect.poll(() => p.z, { timeout: 20000, intervals: [50] }).toBeGreaterThan(85);
    await expect.poll(() => p.speed, { timeout: 5000, intervals: [50] }).toBeGreaterThan(7);
    expect(p.speed).toBeLessThan(9);
    await page.keyboard.up('w');
    await page.keyboard.down('b');
    await expect.poll(() => p.speed).toBeLessThan(0.05);
    await page.keyboard.up('b');
    expect(t.attached).toBe(p.id);
    expect(t.cargo.wood).toBe(20);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
