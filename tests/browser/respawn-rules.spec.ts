// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('arrival coordinates preserve current players, ground the next life and reject unsafe sites', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-respawn-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Arrival builder'),
      initial = createWorld('arrival-workshop', 'Meadow arrivals', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.buildings = [makeBuilding('house', 'home', 110, -80)];
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(8),
    };
    initial.terrain = [{ x: -80, z: 80, radius: 20, height: -20 }];
    initial.creator = creatorSchema.parse({ weather: 'clear', roads: false, scenery: false });
    Object.assign(initial.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
    });
    Object.assign(addPlayer(initial, account.id, account.name), {
      vehicle: 0,
      speed: 0,
      engine: false,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    await page.route('**/src/client/main.ts*', async (route) => {
      const response = await route.fetch();
      const observer = `import {GameScene as ArrivalScene} from '/src/client/scene.ts';const oldSet=ArrivalScene.prototype.setWorld;ArrivalScene.prototype.setWorld=function(...args){globalThis.__arrivalScene=this;return oldSet.apply(this,args)};\n`;
      await route.fulfill({ response, body: observer + (await response.text()) });
    });
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: initial.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const group = page.getByRole('group', { name: 'Construction rules', exact: true });
    const position = () =>
      page.evaluate(
        (id) => (window as any).__arrivalScene.meshes.get(id).position.toArray() as number[],
        account.id,
      );
    await edit();
    await expect(group.locator('[name="respawnX"]')).toHaveValue('0');
    await expect(group.locator('[name="respawnZ"]')).toHaveValue('17');
    await expect(group.locator('[name="spawnClearance"]')).toHaveValue('12');
    await group.locator('[name="respawnX"]').fill('80');
    await group.locator('[name="respawnZ"]').fill('-80');
    mkdirSync('output/respawn-rules/browser', { recursive: true });
    await group
      .locator('[name="respawnX"]')
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/respawn-rules/browser/controls.png' });
    await apply();
    await expect.poll(() => (w().settings as any).respawnX).toBe(80);
    await close();
    expect(p().x).toBe(0);
    expect(p().z).toBe(17);
    const deaths = p().deaths;
    p().age = w().settings.maxAge;
    await expect.poll(() => p().deaths).toBe(deaths + 1);
    await expect.poll(async () => Math.abs((await position())[0] - 80)).toBeLessThan(0.01);
    await expect.poll(async () => Math.abs((await position())[2] + 80)).toBeLessThan(0.01);
    await expect.poll(async () => Math.abs((await position())[1] - 8)).toBeLessThan(0.01);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/respawn-rules/browser/arrival.png' });
    await page.reload();
    await waitForWorld(page);
    expect(p().x).toBe(80);
    expect(p().z).toBe(-80);
    await edit();
    await expect(group.locator('[name="respawnX"]')).toHaveValue('80');
    await expect(group.locator('[name="respawnZ"]')).toHaveValue('-80');
    for (const [x, z, reason] of [
      ['300', '-80', 'within'],
      ['-80', '80', 'dry'],
      ['110', '-80', 'clear'],
    ]) {
      await group.locator('[name="respawnX"]').fill(x);
      await group.locator('[name="respawnZ"]').fill(z);
      await apply();
      await expect(page.locator('#toast')).toContainText(reason);
      expect((w().settings as any).respawnX).toBe(80);
      expect((w().settings as any).respawnZ).toBe(-80);
      expect(p().x).toBe(80);
      expect(p().z).toBe(-80);
    }
    await close();
    await page.keyboard.press('F4');
    await expect.poll(() => p().engine).toBe(true);
    await page.keyboard.down('w');
    await expect.poll(() => Math.hypot(p().x - 80, p().z + 80)).toBeGreaterThan(0.2);
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
