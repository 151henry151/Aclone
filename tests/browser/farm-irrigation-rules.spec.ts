// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('irrigation formula rules persist and show real watering empty plots and refusals', async ({
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
      inventory: { water: 1 },
      fuel: 64,
    });
    const farm = makeBuilding('farm', 'farm', 80, 80);
    Object.assign(farm, {
      owner: account.id,
      farmPlots: 4,
      rotation: 0,
      stock: { water: 1 },
      investment: 1000000,
      plots: Array.from({ length: 4 }, (_, i) => ({
        crop: i < 2 ? 'wheat' : undefined,
        planted: initial.time,
        ready: initial.time + 10800,
        water: 0,

        drainage: true,
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
    const group = page.getByRole('group', { name: 'Crop yield rules', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click(),
      dialog = page.getByRole('dialog');
    await edit();
    const patch = {
      farmIrrigationBaseline: 0.1,
      farmIrrigationRain: 0.2,
      farmIrrigationTreatment: 0.3,
      farmIrrigationCap: 0.8,
      farmIrrigationDryYield: 0.2,
      farmIrrigationMoistureYield: 0.5,
      farmIrrigationWaterCost: 2,
      farmIrrigationTreatments: 1,
      farmWheatThirst: 1,
    };
    for (const [key, value] of Object.entries(patch))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await apply();
    await expect.poll(() => w().settings.farmIrrigationWaterCost).toBe(2);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [key, value] of Object.entries(patch))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-irrigation-rules.png' });
    await close();
    await page.locator('#target button').click();
    const row = (name: string) =>
      dialog.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
    const first = row('Plot 1 · Wheat');
    await expect(first).toContainText('estimated 15 units');
    await expect(first).toContainText('Irrigation 10%');
    await first
      .getByRole('button', { name: 'Water · 2 stocked/carried water', exact: true })
      .click();
    await expect(first).toContainText('estimated 24 units');
    await expect(first).toContainText('Irrigation 40%');
    expect(w().buildings[0].stock.water).toBe(0);
    expect(p().inventory.water).toBe(0);
    expect(w().buildings[0].plots![0].water).toBe(1);
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-irrigation-watered.png' });
    const refusal = async (text: string, path: string) => {
      await expect(page.locator('#toast')).toContainText(text);
      await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
      await expect(page.locator('#toast')).toHaveCSS('color', 'rgb(255, 241, 213)');
      await page.screenshot({ path: `test-results/farm-irrigation-${path}.png` });
    };
    await expect(first.getByRole('button', { name: /^Water ·/ })).toHaveCount(0);
    await expect(first).toContainText('watering treatments 1/1 (watering limit reached)');
    await page.screenshot({ path: 'test-results/farm-irrigation-limit.png' });
    const second = row('Plot 2 · Wheat');
    await second.getByRole('button', { name: /^Water ·/ }).click();
    await refusal('Stock or carry 2 water', 'supplies');
    expect(w().buildings[0].plots![1].water).toBe(0);
    const empty = row('Plot 3 · Fallow');
    await expect(empty.getByRole('button', { name: 'Plant seeds', exact: true })).toBeVisible();
    await expect(empty.getByRole('button', { name: /^Water ·/ })).toHaveCount(0);
    await empty.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-irrigation-empty.png' });
    await close();
    await edit();
    const invalid = group.locator('[name="farmWheatThirst"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await invalid.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-irrigation-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="farmWheatThirst"]')).toHaveValue('1');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
