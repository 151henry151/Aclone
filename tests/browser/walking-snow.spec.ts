// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { walkingSurface } from '../../src/shared/driving-surface';
import { waitForWorld } from './fixtures/ready';

test('real walking and Shift slow in snow, roads retain pace, and owner rules change actual travel', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-walking-snow-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Snow walker');
    const w = createWorld('walking-snow', 'Walking snow', account.id);
    w.script = '';
    w.buildings = [];
    w.settings.mapSize = 500;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    // Overcast rain holds the seeded snow depth steady instead of noon thaw changing the target.
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'rain' });
    w.roads = [{ a: { x: 0, z: -200 }, b: { x: 0, z: 200 }, width: 6 }];
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    w.climate = { snow: 1, snowDepth: 0.04, wetness: 0, snowModel: 1, winterBase: 0 };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { vehicle: 0, x: 20, z: -40, y: 3, heading: 0, engine: false, inventory: {} });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'walking-snow');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await page.getByRole('dialog').locator('[data-do="walk"]').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => p.vehicle).toBe(5);
    const travel = async (depth: number, x: number, boost = false) => {
      Object.assign(p, { x, z: -40, y: 3, heading: 0, speed: 0 });
      w.climate = {
        snow: depth ? 1 : 0,
        snowDepth: depth,
        wetness: 0,
        snowModel: 1,
        winterBase: 0,
      };
      if (boost) await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      const speed = () => 5 * (boost ? 1.7 : 1) * walkingSurface(w, p.x, p.z).speed;
      await expect.poll(() => Math.abs(p.speed - speed())).toBeLessThan(0.05);
      await expect(page.locator('#driving')).toContainText('On foot');
      await expect(page.locator('#driving strong')).toContainText(
        String(Math.round(speed() * 2.237)),
      );
      const start = w.time,
        z = p.z,
        expected = speed();
      await expect.poll(() => w.time - start, { intervals: [100] }).toBeGreaterThan(2);
      const distance = p.z - z,
        elapsed = w.time - start;
      expect(Math.abs(distance / elapsed - expected)).toBeLessThan(0.12);
      await page.keyboard.up('w');
      if (boost) await page.keyboard.up('Shift');
      return distance / elapsed;
    };
    expect(await travel(0.04, 20)).toBeCloseTo(2, 1);
    expect(await travel(0.04, 20, true)).toBeCloseTo(3.4, 1);
    const deep = await travel(1, 20);
    expect(deep).toBeLessThan(0.6);
    await page.screenshot({ path: 'test-results/walking-deep-snow.png' });
    expect(await travel(1, 20, true)).toBeGreaterThan(deep * 1.6);
    expect(await travel(1, 0)).toBeGreaterThan(4.2);
    await page.screenshot({ path: 'test-results/walking-snow-road.png' });
    const edit = async (enabled: boolean, scale: number) => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      const form = page.locator('#settings-form');
      await form.locator('[name="walkingSnow"]').setChecked(enabled);
      await form.locator('[name="walkingSnowScale"]').fill(String(scale));
      await form
        .locator('[name="walkingSnowScale"]')
        .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: 'test-results/walking-snow-rules.png' });
      await form.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
      await expect.poll(() => w.settings.walkingSnow).toBe(enabled);
      await expect.poll(() => w.settings.walkingSnowScale).toBe(scale);
      await page.keyboard.press('Escape');
    };
    await edit(false, 1);
    expect(await travel(1, 20)).toBeCloseTo(5, 1);
    await edit(true, 0);
    expect(await travel(1, 20)).toBeGreaterThan(4.2);
    await edit(true, 2);
    expect(await travel(0.04, 20)).toBeLessThan(1);
    await edit(true, 1);
    expect(await travel(0, 20)).toBeCloseTo(5, 1);
    await page.screenshot({ path: 'test-results/walking-bare-ground.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
