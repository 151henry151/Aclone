// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { worldResources } from '../../src/shared/resources';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('deposit rules persist and show capacity depletion recovery and empty grounds', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-gathering-rates-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
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
      z: 80,
      y: 0,
      heading: 0,
      vehicle: 5,
      engine: false,
      cash: 1000000,
      inventory: {},
      fuel: 64,
    });
    const node = worldResources(initial).find((n) => n.item === 'dirt')!;
    Object.assign(player, { x: node.x, z: node.z, y: 0, vehicle: 5, inventory: { shovel: 1 } });
    initial.resources[node.id] = { amount: 0, updated: initial.time };
    initial.settings.gatheringBaseSeconds = 1;
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
    const group = page.getByRole('group', { name: 'Gathering rules', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      resourceLogsCapacity: 12,
      resourceOtherCapacity: 9,
      resourceLogsRegrowthSeconds: 20,
      resourceOtherRegrowthSeconds: 10,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.locator('[name="resourceRecoveryMultiplier"]').fill('1');
    await apply();
    await expect.poll(() => w().settings.resourceOtherCapacity).toBe(9);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="resourceLogsCapacity"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resource-deposit-rules.png' });
    // Start a fresh depletion interval after editing/reopening, so UI timing is deterministic.
    w().resources![node.id] = { amount: 0, updated: w().time };
    await close();
    await expect(page.locator('#resource-status')).toContainText('needs time to replenish');
    await expect(page.locator('#resource-control')).toBeVisible();
    await expect(page.locator('#resource-stock')).toContainText('0/9 available');
    await expect(page.locator('#resource-gather')).toBeDisabled();
    await page.screenshot({ path: 'test-results/resource-deposit-depleted.png' });
    await expect(page.locator('#resource-gather')).toBeEnabled({ timeout: 20000 });
    await page.locator('[data-do="resources"]:visible').click();
    const row = page
      .getByRole('dialog')
      .locator('article')
      .filter({ has: page.locator(`[data-do="gather"][data-id="${node.id}"]`) });
    await expect(row).toContainText('3/9 available');
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resource-deposit-recovered.png' });
    await close();
    await page.locator('#resource-gather').click();
    await expect.poll(() => p().inventory.dirt).toBe(3);
    await expect(page.locator('#resource-status')).toContainText('needs time to replenish');
    await edit();
    const invalid = group.locator('[name="resourceOtherCapacity"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resource-deposit-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="resourceOtherCapacity"]')).toHaveValue('9');
    await close();
    w().additionalResources = [];
    w().northernIsland = {
      version: 1,
      seed: 1,
      radius: 1000,
      centreZ: -10000,
      preserveZ: -8000,
      blendZ: -9000,
      mountain: { x: 0, z: -10000, height: 100, radius: 500 },
      regions: [],
      rivers: [],
      ponds: [],
      resources: [],
      previousArea: 10000,
      area: 100000,
    };
    await page.reload();
    await waitForWorld(page);
    await page.locator('[data-do="resources"]:visible').click();
    await expect(page.getByRole('dialog').locator('article')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Gathering grounds', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/resource-deposit-empty.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
