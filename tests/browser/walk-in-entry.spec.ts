// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('Ctrl hands a moving walk to entry; the world builder can restore stop-first entry', async ({
  page,
}) => {
  test.setTimeout(150000);
  mkdirSync('output/walk-in-entry', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-walk-in-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Walking visitor');
    const initial = createWorld('walk-in', 'Walk straight in', account.id);
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
      arrivalMinSeconds: 4,
      arrivalMaxSeconds: 4,
      respawnX: 300,
      respawnZ: 300,
    });
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      vehicle: 5,
      x: 0,
      z: 15,
      y: 0,
      heading: Math.PI,
      speed: 0,
      engine: false,
    });
    const shop = makeBuilding('shop', 'market', 0, 0);
    shop.name = 'Village shop';
    initial.buildings = [shop];
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const p = () => w().players[player.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'walk-in');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.down('w');
    await expect.poll(() => p().speed).toBeGreaterThan(1);
    await page.keyboard.press('Control');
    await expect.poll(() => p().task?.kind).toBe('entering');
    expect(p().speed).toBe(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#task-control')).toBeVisible();
    await page.screenshot({ path: 'output/walk-in-entry/walking-inside.png' });
    await expect.poll(() => p().inside).toBe(shop.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(p().speed).toBe(0);
    expect(p().task).toBeUndefined();
    await expect(page.locator('#toast')).not.toContainText('Stop outside');
    await page.keyboard.up('w');
    await page.screenshot({ path: 'output/walk-in-entry/shop-menu.png' });
    await page.keyboard.press('Escape');
    await expect.poll(() => p().task).toBeUndefined();
    expect(p().inside).toBeUndefined();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const setting = page.getByRole('checkbox', {
      name: 'Allow building entry while walking',
      exact: true,
    });
    await expect(setting).toBeChecked();
    await setting.uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.arrivalWalkIn).toBe(false);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(setting).not.toBeChecked();
    await page.keyboard.press('Escape');
    Object.assign(p(), { x: 0, z: 15, y: 0, heading: Math.PI, speed: 0 });
    w().revision++;
    await page.waitForTimeout(500);
    await page.keyboard.down('w');
    await expect.poll(() => p().speed).toBeGreaterThan(1);
    await page.keyboard.press('Control');
    await expect(page.locator('#toast')).toContainText('Stop outside');
    expect(p().inside).toBeUndefined();
    expect(p().task).toBeUndefined();
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(p().speed)).toBeLessThan(0.5);
    await page.keyboard.press('Control');
    await expect.poll(() => p().inside).toBe(shop.id);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
