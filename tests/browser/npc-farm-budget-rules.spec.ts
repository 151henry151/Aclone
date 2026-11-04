// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { sustainableAsk } from '../../src/server/npc/pricing';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('farm budget rules persist, change price forecasts and refuse invalid values', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-loan-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('loan-rules', 'Loan rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      parishOrders: false,
      salesTax: 0,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const farm = makeBuilding('farm', 'farm', 50, 0),
      shop = makeBuilding('shop', 'market', 70, 0);
    Object.assign(farm, {
      owner: account.id,
      wage: 1000,
      stock: {},
      buy: { water: 100, compost: 200 },
      sell: { wheat: 1000 },
    });
    shop.stock = { water: 100, compost: 100 };
    shop.sell = { water: 100, compost: 200 };
    initial.buildings = [farm, shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false, cash: 1000, fuel: 0, inventory: {} });
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
    const quote = () =>
      sustainableAsk(
        w(),
        w().buildings.find((b) => b.id === farm.id)!,
        'wheat',
      );
    expect(quote()).toBe(90);
    const group = page.getByRole('group', { name: 'Resident business budgets', exact: true });
    await edit();
    const patch = {
      npcFarmYieldShare: 1,
      npcFarmWaterBudget: 0,
      npcFarmCompostBudget: 0,
      npcFarmCustomerFundedItems: 10,
      npcFarmCustomerStockLimit: 12,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcFarmYieldShare).toBe(1);
    expect(quote()).toBe(31);
    expect(p().cash).toBe(1000);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcFarmYieldShare"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/farm-budget-rules.png' });
    await group.locator('[name="npcFarmYieldShare"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcFarmYieldShare).toBe(0);
    expect(quote()).toBe(Infinity);
    expect(p().cash).toBe(1000);
    const invalid = group.locator('[name="npcFarmYieldShare"]');
    await invalid.fill('1.05');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '1',
    );
    await page.screenshot({ path: 'test-results/farm-budget-invalid.png' });
    expect(w().settings.npcFarmYieldShare).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcFarmYieldShare"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
