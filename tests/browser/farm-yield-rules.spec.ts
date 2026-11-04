// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('crop yield rules persist and show compost effects empty plots and refusals', async ({
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
      farmPlots: 4,
      rotation: 0,
      stock: { compost: 1 },
      investment: 1000000,
      plots: Array.from({ length: 4 }, (_, i) => ({
        crop: i < 2 ? 'wheat' : undefined,
        planted: initial.time,
        ready: initial.time + 10800,
        water: 3,
        previous: 'wheat',
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
    await group.locator('[name="farmCompostYieldBonus"]').fill('0.5');
    await group.locator('[name="farmRotationYieldPenalty"]').fill('0.25');
    await apply();
    await expect.poll(() => w().settings.farmCompostYieldBonus).toBe(0.5);
    await close();
    await edit();
    await expect(group.locator('[name="farmCompostYieldBonus"]')).toHaveValue('0.5');
    await expect(group.locator('[name="farmRotationYieldPenalty"]')).toHaveValue('0.25');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-yield-rules.png' });
    await close();
    await page.locator('#target button').click();
    const row = dialog
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Plot 1 · Wheat', exact: true }) });
    await expect(dialog).toContainText('repeated crop families lose 25% yield');
    await expect(row).toContainText('estimated 45 units');
    await row.getByRole('button', { name: /^Fertilize/ }).click();
    await expect(row).toContainText('50% bonus');
    await expect(row).toContainText('estimated 67 units');
    expect(w().buildings[0].stock.compost).toBe(0);
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-yield-compost.png' });
    const empty = dialog
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Plot 3 · Fallow', exact: true }) });
    await expect(empty.getByRole('button', { name: 'Plant seeds', exact: true })).toBeVisible();
    await empty.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-yield-empty.png' });
    await close();
    w().buildings[0].investment = 0;
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target button').click();
    const second = dialog
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Plot 2 · Wheat', exact: true }) });
    await second.getByRole('button', { name: /^Fertilize/ }).click();
    await expect(page.locator('#toast')).toContainText('Stock or carry compost or fund');
    expect(w().buildings[0].plots![1].fertilized).toBe(false);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('color', 'rgb(255, 241, 213)');
    await second.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-yield-refusal.png' });
    await close();
    await edit();
    const invalid = group.locator('[name="farmRotationYieldPenalty"]');
    await invalid.fill('1.01');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeOverflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-yield-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="farmRotationYieldPenalty"]')).toHaveValue('0.25');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
