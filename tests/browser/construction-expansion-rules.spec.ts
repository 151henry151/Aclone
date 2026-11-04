// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, money } from '../../src/shared/simulation';
import { buildingDesignQuote } from '../../src/shared/building-designs';
import { buildings, items } from '../../src/shared/catalog';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('expansion rules change visible bills and ordinary construction while preserving affordability checks', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-expansion-rules-')),
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
      mapSize: 500,
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
      cash: 250000,
      inventory: {},
      fuel: 64,
    });
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
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await edit();
    await group.locator('[name="expandedConstructionCostMultiplier"]').fill('3');
    await group.locator('[name="largeConstructionCostMultiplier"]').fill('4');
    await apply();
    await expect.poll(() => w().settings.largeConstructionCostMultiplier).toBe(4);
    await close();
    await edit();
    await expect(group.locator('[name="expandedConstructionCostMultiplier"]')).toHaveValue('3');
    await expect(group.locator('[name="largeConstructionCostMultiplier"]')).toHaveValue('4');
    await group.locator('[name="expandedConstructionCostMultiplier"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/expansion-rules.png' });
    await close();
    const build = async () => {
      await page.locator('[data-do="construction"]:visible').click();
      await page.getByLabel('Building type', { exact: true }).selectOption('home');
      await page.getByLabel('Architectural model', { exact: true }).selectOption('model-1');
      await page.getByLabel('Surface finish', { exact: true }).selectOption('red-timber');
    };
    const estimate = page.locator('[data-build-estimate]'),
      place = page.getByRole('button', { name: 'Place foundation', exact: true });
    const standard = buildingDesignQuote(
      'home',
      buildings.home,
      'red-timber',
      'standard',
      'model-1',
    );
    const checkBill = async (mult: number) => {
      await expect(estimate).toContainText(`Foundation: ${money(standard.price * mult)}`);
      for (const [item, n] of Object.entries(standard.materials))
        await expect(estimate.locator('.build-materials')).toContainText(
          `${n * mult} ${items[item].name}`,
        );
    };
    await build();
    await page.getByLabel('Building size', { exact: true }).selectOption('expanded');
    await checkBill(3);
    await expect(place).toBeEnabled();
    await estimate.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/expansion-expanded-bill.png' });
    await page.getByLabel('Building size', { exact: true }).selectOption('large');
    await checkBill(4);
    await expect(estimate).toContainText('Not enough cash for the foundation and town tax');
    await expect(place).toBeDisabled();
    await estimate.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/expansion-unaffordable.png' });
    expect(w().buildings).toHaveLength(0);
    expect(p().cash).toBe(250000);
    await close();
    await edit();
    const large = group.locator('[name="largeConstructionCostMultiplier"]');
    await large.fill('1');
    await apply();
    await expect.poll(() => w().settings.largeConstructionCostMultiplier).toBe(1);
    await large.fill('0');
    await apply();
    await expect(large).toBeFocused();
    expect(await large.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.locator('[name="expandedConstructionCostMultiplier"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/expansion-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="largeConstructionCostMultiplier"]')).toHaveValue('1');
    await close();
    await build();
    await page.getByLabel('Building size', { exact: true }).selectOption('large');
    await checkBill(1);
    await expect(place).toBeEnabled();
    await estimate.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/expansion-unit-cost.png' });
    await page.getByLabel('Building size', { exact: true }).selectOption('expanded');
    await checkBill(3);
    await place.click();
    await expect.poll(() => w().buildings.length).toBe(1);
    const b = w().buildings[0];
    expect(b.constructionCost).toBe(standard.price * 3);
    expect(b.capacity).toBe(standard.capacity * 1.5);
    for (const [item, n] of Object.entries(standard.materials))
      expect(b.construction![item]).toBe(n * 3);
    expect(p().cash).toBe(250000 - standard.price * 3);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
