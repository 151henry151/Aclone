// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';

test('survey, reserve, work, abandon and resume a hillside with real keyboard passes', async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(10000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-earthwork-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const evidence = 'output/earthworks/working';
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Earthworker');
    const w = createWorld('earthwork-browser', 'Earthworks hillside', account.id);
    w.script = '';
    w.towns = [];
    w.terrain = [];
    w.zones = [];
    w.roads = [];
    w.buildings = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array.from({ length: 1089 }, (_, i) =>
        Math.max(-30, Math.min(35, 10 + 0.15 * (((i % 33) / 32) * 500 - 330))),
      ),
    };
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -40,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      arrivalAnimation: 'off',
      vehiclesPersist: true,
      earthworksDozerVolume: 10,
      earthworksWorkingSpeed: 2,
      earthworksPlantLicence: true,
      vehicleMaintenance: false,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 80,
      z: 80,
      y: 10,
      heading: 0,
      vehicle: 38,
      fleet: [0, 5, 38],
      skills: ['plant operator'],
      engine: true,
      fuel: 200,
      fuelVehicle: 38,
      online: true,
      cash: 30_000_000,
    });
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
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    const root = page.locator('[data-earthworks-panel]');
    await expect(root).toContainText('No earthwork sites');
    for (const [name, value] of Object.entries({ width: '20', depth: '20', target: '10' }))
      await root.locator(`[name="${name}"]`).fill(value);
    await expect(root.locator('[data-earthwork-survey]')).toContainText('Cut');
    await expect(root.locator('[data-earthwork-survey]')).toContainText('Fill');
    await page.screenshot({ path: evidence + '/survey.png' });
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(1);
    await expect(root).toContainText('0%');
    await page.keyboard.press('Escape');
    await page.keyboard.press('g');
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await page.keyboard.down('w');
    await page.waitForTimeout(2200);
    await page.keyboard.up('w');
    await expect.poll(() => w.earthworks![0].progress).toBeGreaterThan(0);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    const site = root.locator('[data-earthwork-site]');
    await site.getByRole('button', { name: 'Abandon work', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.active).toBe(false);
    await expect(site.getByRole('button', { name: 'Resume work', exact: true })).toBeVisible({
      timeout: 5000,
    });
    const scar = terrainHeight(w, 86, 80);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    await site.getByRole('button', { name: 'Resume work', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.active).toBe(true);
    expect(terrainHeight(w, 86, 80)).toBe(scar);
    await page.keyboard.press('Escape');
    if (!p.engine) await page.keyboard.press('F4');
    await expect.poll(() => p.engine).toBe(true);
    if (!p.earthmovingImplement) await page.keyboard.press('g');
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    for (let i = 0; i < 16 && w.earthworks![0].progress < 1; i++) {
      const forward = p.z < 80,
        key = forward ? 'w' : 's';
      await page.keyboard.down(key);
      await expect
        .poll(() => w.earthworks![0].progress === 1 || (forward ? p.z >= 87 : p.z <= 73), {
          timeout: 30000,
          intervals: [200],
        })
        .toBe(true)
        .catch((error) => {
          console.error(
            'Earthwork motion',
            JSON.stringify({
              x: p.x,
              z: p.z,
              y: p.y,
              speed: p.speed,
              engine: p.engine,
              fuel: p.fuel,
              vehicle: p.vehicle,
              implement: p.earthmovingImplement,
              heading: p.heading,
              pad: w.earthworks![0],
            }),
          );
          throw error;
        });
      await page.keyboard.up(key);
      await page.waitForTimeout(500);
    }
    await expect.poll(() => w.earthworks![0].progress).toBe(1);
    expect(terrainHeight(w, 86, 80)).toBeCloseTo(10, 5);
    await page.screenshot({ path: evidence + '/completed.png' });
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    await expect(site).toContainText('100%');
    await expect(site).toContainText('Complete');
    await page.screenshot({ path: evidence + '/complete-panel.png' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => w.buildings.length).toBe(1);
    expect(w.buildings[0].foundationY).toBeDefined();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fill shortages, inventory and trailer delivery, gravel and weathering remain usable on a phone', async ({
  page,
}) => {
  test.setTimeout(180000);

  page.setDefaultTimeout(10000);
  await page.setViewportSize({ width: 430, height: 900 });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-earthfill-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Fill operator');
    let w = createWorld('fill-browser', 'Fill works', account.id);
    Object.assign(w, { script: '', towns: [], terrain: [], zones: [], roads: [], buildings: [] });
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
      arrivalAnimation: 'off',
      vehiclesPersist: true,
      earthworksDozerVolume: 10,
      earthworksFillVolume: 100,
      earthworksWorkingSpeed: 2,
      vehicleMaintenance: false,
    });
    let p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 80,
      z: 80,
      y: 20,
      heading: 0,
      vehicle: 38,
      fleet: [0, 5, 38],
      skills: ['plant operator'],
      engine: true,
      fuel: 200,
      fuelVehicle: 38,
      inventory: { gravel: 8 },
      online: true,
    });
    w.trailers = {
      tip: { id: 'tip', kind: 'dump', owner: p.id, x: 90, z: 80, heading: 0, cargo: { dirt: 1 } },
    };
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
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    const root = page.locator('[data-earthworks-panel]');
    for (const [name, value] of Object.entries({ width: '8', depth: '8', target: '20.5' }))
      await root.locator(`[name="${name}"]`).fill(value);
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(1);
    const site = root.locator('[data-earthwork-site]');
    await expect(site).toContainText('Deliver');
    await site.locator('[data-earthwork-materials] > summary').click();
    await site.getByRole('button', { name: 'Deliver fill', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Not enough supplied material');
    // Refused actions restore the server's atomic world checkpoint.
    w = app.worlds.get(w.id)!;
    p = w.players[account.id];
    expect(w.earthworks![0].work!.delivered).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('g');
    await page.keyboard.down('w');
    await page.waitForTimeout(1500);
    await page.keyboard.up('w');
    expect(w.earthworks![0].progress).toBe(0);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    p.inventory.dirt = 1;
    await root.locator('[data-earthwork-materials] > summary').click();

    await site.getByRole('button', { name: 'Deliver fill', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.delivered).toBe(100);
    await expect(site).toContainText('Deliver 95.84 m³ more fill');
    await expect(root.locator('[data-earthwork-new]')).not.toHaveAttribute('open');
    await site.locator('[name="trailer"]').selectOption('tip');
    await site.getByRole('button', { name: 'Deliver fill', exact: true }).click();
    await expect.poll(() => w.earthworks![0].work!.delivered).toBe(200);
    expect(w.trailers!.tip.cargo.dirt ?? 0).toBe(0);
    await expect(site).toContainText('Fill supplied');
    await expect(site.locator('[name="trailer"]')).toHaveValue('tip');
    await expect(site.getByRole('button', { name: 'Deliver fill', exact: true })).toBeDisabled();
    await page.screenshot({ path: 'output/earthworks/working/mobile-fill.png' });
    await page.keyboard.press('Escape');
    for (let i = 0; i < 14 && w.earthworks![0].progress < 1; i++) {
      const forward = p.z < 80,
        key = forward ? 'w' : 's';
      await page.keyboard.down(key);
      await expect
        .poll(() => w.earthworks![0].progress === 1 || (forward ? p.z >= 82.5 : p.z <= 77.5), {
          timeout: 20000,
          intervals: [150],
        })
        .toBe(true);
      await page.keyboard.up(key);
      await page.waitForTimeout(300);
    }
    await expect.poll(() => w.earthworks![0].progress).toBe(1);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Earthworks', exact: true }).click();
    await site.locator('[data-earthwork-materials] > summary').click();
    await site.getByRole('button', { name: 'Spread gravel', exact: true }).click();
    await expect.poll(() => w.earthworks![0].finish).toBe('gravel');
    expect(p.inventory.gravel ?? 0).toBe(0);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'output/earthworks/working/gravel.png' });
    // Exercise the ordinary simulation clock with a short configurable recovery period.
    w.settings.earthworksGrassDays = 0.1;
    w.settings.dayLength = 10;
    await expect.poll(() => w.earthworks![0].finish).toBe('grass');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'output/earthworks/working/grass.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
