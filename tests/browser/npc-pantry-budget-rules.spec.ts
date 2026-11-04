// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { homecomingPlan } from '../../src/server/npc/homecoming';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('pantry budget rules persist, change shopping and refuse invalid values', async ({ page }) => {
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
      hungerRate: 4,
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
    const bank = makeBuilding('bank', 'bank', 0, 0);
    bank.investment = 1000000;
    const home = makeBuilding('home', 'home', 50, 0),
      shop = makeBuilding('shop', 'market', 70, 0);
    home.owner = account.id;
    home.stock = { water: 100 };
    shop.stock = { bread: 100 };
    shop.sell = { bread: 100 };
    initial.buildings = [home, shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 100000,
      hunger: 10000,
      thirst: 0,
      home: home.id,
      fuel: 0,
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
    const quantity = () =>
      homecomingPlan(w(), p(), 10000, undefined, false).flatMap((s) =>
        s.kind === 'act' && s.action.type === 'trade' ? [s.action.quantity] : [],
      )[0];
    expect(quantity()).toBe(2);
    const group = page.getByRole('group', { name: 'Resident household budget', exact: true });
    await edit();
    const patch = {
      npcPantryNeedAllowance: 0,
      npcUnhousedProvisionItems: 3,
      npcProvisionDrinkCashReserve: 600,
      npcProvisionBatchLimit: 5,
      npcLodgingBufferSeconds: 300,
      npcLodgingCashReserve: 700,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcPantryNeedAllowance).toBe(0);
    expect(quantity()).toBe(3);
    expect(p().cash).toBe(100000);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcPantryNeedAllowance"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pantry-budget-rules.png' });
    await group.locator('[name="npcProvisionBatchLimit"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcProvisionBatchLimit).toBe(0);
    expect(quantity()).toBeUndefined();
    expect(p().cash).toBe(100000);
    expect(w().buildings.find((b) => b.id === shop.id)!.stock.bread).toBe(100);
    const invalid = group.locator('[name="npcLodgingBufferSeconds"]');
    await invalid.fill('86401');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '86400',
    );
    await page.screenshot({ path: 'test-results/pantry-budget-invalid.png' });
    expect(w().settings.npcLodgingBufferSeconds).toBe(300);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcLodgingBufferSeconds"]')).toHaveValue('300');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
