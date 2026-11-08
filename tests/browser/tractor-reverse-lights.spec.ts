// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('reverse up to a trailer at night with low graphics, hitch, and configure rear lighting', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-reverse-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Night driver');
  const w = createWorld('reverse-night', 'Night hitching', account.id);
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.towns = [];
  w.zones = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  w.landscape = {
    heightmap: Array(1089).fill(0),
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
  };
  Object.assign(w.settings, {
    seaLevel: -10,
    dayLength: 0,
    time: 0,
    hungerRate: 0,
    thirstRate: 0,
    arrivalAnimation: 'off',
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: -2,
    y: 0,
    heading: 0,
    vehicle: 24,
    lastTractor: 24,
    fleet: [0, 24, 5],
    fuelVehicle: 24,
    fuel: 30,
    engine: true,
    lights: false,
    speed: 0,
  });
  w.trailers = {
    box: { id: 'box', kind: 'box', owner: p.id, x: 0, z: -12, heading: 0, cargo: { wood: 2 } },
  };
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  mkdirSync('output/trailer-feedback/reverse-browser', { recursive: true });
  const beam = () =>
    page.evaluate(() => {
      const l = (window as any).__reverseScene.reverseLight;
      return { intensity: l.intensity, range: l.distance, shadow: l.castShadow };
    });
  try {
    const port = await app.listen();
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__reverseScene=scene;\n',
      });
    });
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
    // Orbit through the normal drag control to see the rear hitch and the ground beside it.
    await page.mouse.move(600, 450);
    await page.mouse.down();
    await page.mouse.move(825, 450, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(1000);
    expect((await beam()).intensity).toBe(0);
    await page.screenshot({ path: 'output/trailer-feedback/reverse-browser/stopped_at_night.png' });
    await page.keyboard.down('s');
    try {
      await expect.poll(async () => (await beam()).intensity).toBe(90);
      await page.screenshot({
        path: 'output/trailer-feedback/reverse-browser/reversing_toward_drawbar.png',
      });
      await expect.poll(() => p.z).toBeLessThan(-3.5);
    } finally {
      await page.keyboard.up('s');
    }
    await page.keyboard.press('F4');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.5);
    await expect.poll(async () => (await beam()).intensity).toBe(0);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Hitch trailer', exact: true }).click();
    await expect.poll(() => w.trailers!.box.attached).toBe(p.id);
    expect(w.trailers.box.cargo).toEqual({ wood: 2 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F4');
    await page.keyboard.down('w');
    try {
      await expect.poll(() => p.speed).toBeGreaterThan(1);
      expect((await beam()).intensity).toBe(0);
    } finally {
      await page.keyboard.up('w');
    }
    await page.keyboard.press('F4');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', {
      name: 'Vehicle running costs and reversing lights',
      exact: true,
    });
    const enabled = group.locator('[name="tractorReverseLights"]');
    await expect(enabled).toBeChecked();
    await enabled.uncheck();
    await group.locator('[name="tractorReverseLightIntensity"]').fill('71');
    await group.locator('[name="tractorReverseLightRange"]').fill('14');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.tractorReverseLights).toBe(false);
    await expect.poll(() => w.settings.tractorReverseLightRange).toBe(14);
    await page.keyboard.press('Escape');
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(enabled).not.toBeChecked();
    await expect(group.locator('[name="tractorReverseLightIntensity"]')).toHaveValue('71');
    await expect(group.locator('[name="tractorReverseLightRange"]')).toHaveValue('14');
    await enabled.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: 'output/trailer-feedback/reverse-browser/world_builder_reversing_lights.png',
    });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
