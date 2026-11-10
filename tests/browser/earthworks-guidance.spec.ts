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

test('survey guidance explains reach and stays visible to the backhoe driver', async ({ page }) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(10000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-earthwork-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const evidence = 'output/earthworks/guidance';
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
      earthworksBackhoeVolume: 10,
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
      vehicle: 39,
      fleet: [0, 5, 38, 39],
      skills: ['plant operator'],
      engine: true,
      fuel: 200,
      fuelVehicle: 39,
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
    await expect(root.getByRole('button', { name: 'Centre on me', exact: true })).toBeVisible();
    await root.getByText('Precise position and shoulder', { exact: true }).click();
    await root.locator('[name="x"]').fill('100');
    await root.getByRole('button', { name: 'Use ground level here', exact: true }).click();
    await expect(root.locator('[data-earthwork-reach]')).toContainText('20 m');
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeDisabled();
    w.settings.constructionPlacementReach = 25;
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeEnabled();
    w.settings.constructionPlacementReach = 4;
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeDisabled();
    await root.getByRole('button', { name: 'Centre on me', exact: true }).click();
    await expect(root.locator('[name="x"]')).toHaveValue('80');
    await root.locator('[name="width"]').fill('20');
    await root.locator('[name="depth"]').fill('20');
    await root.locator('[name="target"]').fill('10');
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeEnabled();
    await root.getByText('Precise position and shoulder', { exact: true }).click();
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeInViewport({
      ratio: 1,
      timeout: 1500,
    });
    await page.setViewportSize({ width: 430, height: 900 });
    await expect(root.getByRole('button', { name: 'Confirm pad', exact: true })).toBeInViewport({
      ratio: 1,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: evidence + '/survey.png' });
    await root.getByRole('button', { name: 'Confirm pad', exact: true }).click();
    await expect.poll(() => w.earthworks?.length).toBe(1);
    await root.getByRole('button', { name: 'Guide me here', exact: true }).click();
    await expect(root).toHaveCount(0);
    const hud = page.locator('#earthwork-guide');
    await expect(hud).toBeVisible();
    await expect(hud).toContainText('Lower');
    await hud.getByRole('button', { name: 'Lower implement', exact: true }).click();
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await expect(hud).toContainText('Drive');
    await page.screenshot({ path: evidence + '/driver.png' });
    await page.keyboard.down('w');
    await page.waitForTimeout(1800);
    await page.keyboard.up('w');
    await expect.poll(() => w.earthworks![0].work!.done).toBeGreaterThan(0);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: evidence + '/driver.png' });
    p.vehicle = 5;
    p.engine = false;
    await expect(hud).toBeHidden();
    p.vehicle = 39;
    p.engine = true;
    await expect(hud).toBeVisible();
    await page.setViewportSize({ width: 430, height: 900 });
    await expect(hud).toBeVisible();
    await expect(hud.getByRole('button', { name: 'Raise implement', exact: true })).toBeVisible({
      timeout: 1500,
    });
    await hud.getByRole('button', { name: 'Raise implement', exact: true }).click();
    await expect.poll(() => p.earthmovingImplement).toBe(false);
    await hud.getByRole('button', { name: 'Lower implement', exact: true }).click();
    await expect.poll(() => p.earthmovingImplement).toBe(true);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: evidence + '/mobile-driver.png' });
    p.engine = false;
    await expect(hud).toContainText('Start the engine');
    await hud.getByRole('button', { name: 'Start engine', exact: true }).click();
    await expect.poll(() => p.engine).toBe(true);
    const fuel = p.fuel;
    p.fuel = 0;
    await expect(hud).toContainText('Out of fuel');
    p.fuel = fuel;
    const pad = w.earthworks![0],
      owner = pad.owner;
    pad.owner = 'another';
    await expect(hud).toContainText('No building plan is needed');
    pad.owner = owner;
    await expect(hud).toContainText('Work-speed assist');
    await page.setViewportSize({ width: 1440, height: 900 });
    for (let i = 0; i < 16 && w.earthworks![0].progress < 1; i++) {
      const forward = p.z < 80,
        key = forward ? 'w' : 's';
      await page.keyboard.down(key);
      await expect
        .poll(() => w.earthworks![0].progress === 1 || (forward ? p.z >= 87 : p.z <= 73), {
          timeout: 20000,
          intervals: [150],
        })
        .toBe(true);
      await page.keyboard.up(key);
      await page.waitForTimeout(300);
    }
    await expect.poll(() => w.earthworks![0].progress).toBe(1);
    await expect(hud).toContainText('Finished');
    await page.screenshot({ path: evidence + '/completed.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const settings = page.locator('#settings-form');
    await settings.locator('[name="earthworksSpeedAssist"]').uncheck();
    await settings.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.earthworksSpeedAssist).toBe(false);
    await page.keyboard.press('Escape');
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(settings.locator('[name="earthworksSpeedAssist"]')).not.toBeChecked();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
