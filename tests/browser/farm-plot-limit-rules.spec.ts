// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { farmExpansionCost, farmPlotCount } from '../../src/shared/farm-land';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('farm plot limit governs expansion and preserves twenty plots when lowered', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-farm-limit-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Builder'),
      initial = createWorld('construction-rules', 'Construction', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    initial.zones = [];
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      parishOrders: false,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    initial.buildings = [];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 80,
      z: 93,
      y: 0,
      heading: Math.PI,
      vehicle: 5,
      engine: false,
      cash: 1000000,
      inventory: {},
      fuel: 64,
    });
    const farm = makeBuilding('farm', 'farm', 80, 80);
    Object.assign(farm, {
      owner: account.id,
      farmPlots: 16,
      rotation: 0,
      stock: {},
      investment: 1000000,
      plots: Array.from({ length: 16 }, () => ({
        planted: 0,
        ready: 0,
        water: 0,
        fertilized: false,
      })),
    });
    initial.buildings = [farm];
    player.skills = ['farmer'];
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
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
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Construction rules', exact: true }),
      limit = group.locator('[name="maximumFarmPlots"]'),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click(),
      dialog = page.getByRole('dialog');
    await page.locator('#target button').click();
    await expect(dialog).toContainText('16 / 16 plots');
    await expect(dialog.getByRole('button', { name: /Buy four more plots/ })).toHaveCount(0);
    await close();
    await edit();
    await limit.fill('20');
    await apply();
    await expect.poll(() => w().settings.maximumFarmPlots).toBe(20);
    await close();
    await edit();
    await expect(limit).toHaveValue('20');
    await limit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-limit-rules.png' });
    await close();
    await page.locator('#target button').click();
    await expect(dialog).toContainText('16 / 20 plots');
    const before = p().cash,
      cost = farmExpansionCost(w().buildings[0]);
    await dialog.getByRole('button', { name: /Buy four more plots/ }).click();
    await expect.poll(() => farmPlotCount(w().buildings[0])).toBe(20);
    expect(p().cash).toBe(before - cost);
    await expect(dialog).toContainText('20 / 20 plots');
    await expect(dialog.getByRole('heading', { name: /^Plot [0-9]+/ })).toHaveCount(20);
    await expect(dialog.getByRole('button', { name: /Buy four more plots/ })).toHaveCount(0);
    await expect(dialog).toContainText('maximum 20 plots');
    await dialog.getByRole('heading', { name: 'Farmland', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-limit-cap.png' });
    await dialog
      .getByRole('heading', { name: 'Plot 20 · Fallow', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-limit-twentieth-plot.png' });
    await close();
    await edit();
    await limit.fill('4');
    await apply();
    await expect.poll(() => w().settings.maximumFarmPlots).toBe(4);
    await close();
    await page.locator('#target button').click();
    await expect(dialog).toContainText('20 / 4 plots');
    await expect(dialog.getByRole('heading', { name: /^Plot [0-9]+/ })).toHaveCount(20);
    await expect(dialog.getByRole('button', { name: /Buy four more plots/ })).toHaveCount(0);
    await close();
    await edit();
    await limit.fill('6');
    await apply();
    await expect(limit).toBeFocused();
    expect(await limit.evaluate((i: HTMLInputElement) => i.validity.stepMismatch)).toBe(true);
    await limit.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-limit-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(limit).toHaveValue('4');
    await close();
    expect(farmPlotCount(w().buildings[0])).toBe(20);
    // Inspect the new land from a clear viewpoint in this isolated local world.
    Object.assign(p(), { x: 130, z: 125, heading: Math.PI });
    await page.reload();
    await waitForWorld(page);
    await page.screenshot({ path: 'test-results/farm-limit-fields.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
