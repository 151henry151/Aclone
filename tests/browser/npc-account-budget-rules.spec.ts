import type { Step } from '../../src/server/npc/decision';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { spaceChoices } from '../../src/server/npc/space';
import { spaceGoods } from '../../src/shared/galaxy';
import { operationAction } from '../../src/server/npc/player-operations';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('account trade budgets persist, change suggestions and refuse invalid input', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-account-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    account.credits = 100000;
    app.universe.save(account);
    const initial = createWorld('account-rules', 'Account trade budgets', account.id);
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
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const shop = makeBuilding('shop', 'market', 50, 0);
    Object.assign(shop, {
      owner: 'seller',
      wage: 0,
      investment: 0,
      stock: { flour: 100 },
      buy: { flour: 100 },
      sell: { flour: 100 },
    });
    const buyer = makeBuilding('buyer', 'market', 70, 0);
    Object.assign(buyer, {
      owner: 'buyer',
      investment: 100000,
      buy: { flour: 200 },
      sell: {},
      stock: {},
    });
    initial.buildings = [shop, buyer];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 20000,
      hunger: 0,
      thirst: 0,
      fuel: 64,
      inventory: {},
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
    const load = () =>
      spaceChoices(account, app.worlds, app.universe, w().settings)
        .flatMap((c) => c.plan)
        .filter(
          (s): s is Extract<Step, { kind: 'operation' }> =>
            s.kind === 'operation' && s.operation === 'spaceTrade',
        )
        .map(operationAction)
        .find((a) => a.buy === true && a.item === spaceGoods[0])?.quantity;
    expect(load()).toBe(5);
    const group = page.getByRole('group', {
      name: 'Resident account trade budgets',
      exact: true,
    });
    await edit();
    const patch = {
      npcExchangeCashReserve: 5000,
      npcExchangeCreditLoad: 3,
      npcAccountTradeCreditReserve: 20,
      npcAccountTradeBuyLoad: 2,
      npcAccountTradeSellLoad: 4,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcAccountTradeBuyLoad).toBe(2);
    expect(load()).toBe(2);
    expect(account.credits).toBe(100000);
    expect(account.cargo).toEqual({});
    expect(p().cash).toBe(20000);
    expect(w().buildings[0].investment).toBe(0);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcExchangeCashReserve"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/account-budget-rules.png' });
    await group.locator('[name="npcAccountTradeSellLoad"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/account-budget-last-fields.png' });
    await group.locator('[name="npcAccountTradeBuyLoad"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcAccountTradeBuyLoad).toBe(0);
    expect(load()).toBeUndefined();
    const invalid = group.locator('[name="npcAccountTradeBuyLoad"]');
    await invalid.fill('-1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '0',
    );
    await page.screenshot({ path: 'test-results/account-budget-invalid.png' });
    expect(w().settings.npcAccountTradeBuyLoad).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcAccountTradeBuyLoad"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
