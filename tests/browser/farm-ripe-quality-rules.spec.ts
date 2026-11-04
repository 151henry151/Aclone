// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('ripe quality rules persist and show estimates empty plots and stockroom refusal', async ({
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
    initial.time = 18000;
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
      stock: { wheat: farm.capacity },
      investment: 1000000,
      plots: Array.from({ length: 4 }, (_, i) => ({
        crop: i < 2 ? 'wheat' : undefined,
        planted: initial.time - 12600,
        ready: initial.time - 1800,
        water: 3,

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
      farmRipeQualitySeconds: 600,
      farmLateMaximumLoss: 0.5,
      farmLateLossPerDay: 0.1,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.farmRipeQualitySeconds).toBe(600);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="farmRipeQualitySeconds"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-quality-rules.png' });
    await close();
    await page.locator('#target button').click();
    const first = dialog
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Plot 1 · Wheat', exact: true }) });
    await expect(first).toContainText('Ready to harvest');
    await expect(first).toContainText('estimated 48 units');
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-quality-ripe.png' });
    const note = dialog.locator('p.note').filter({ hasText: 'Ripe crops keep full quality' });
    await expect(note).toContainText('600 real seconds');
    await expect(note).toContainText('10% per game day up to 50%');
    await note.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-quality-help.png' });
    const empty = dialog
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Plot 3 · Fallow', exact: true }) });
    await expect(empty.getByRole('button', { name: 'Plant seeds', exact: true })).toBeVisible();
    await empty.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-quality-empty.png' });
    await first.getByRole('button', { name: 'Harvest', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Make room in the stockroom');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('color', 'rgb(255, 241, 213)');
    expect(p().task).toBeUndefined();
    expect(w().buildings[0].plots![0].crop).toBe('wheat');
    await page.screenshot({ path: 'test-results/farm-quality-refusal.png' });
    await expect(dialog).not.toBeVisible();
    await edit();
    const invalid = group.locator('[name="farmLateMaximumLoss"]');
    await invalid.fill('1.01');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeOverflow)).toBe(true);
    await invalid.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-quality-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="farmLateMaximumLoss"]')).toHaveValue('0.5');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
