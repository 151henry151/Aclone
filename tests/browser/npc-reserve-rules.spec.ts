// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { economyChoices } from '../../src/server/npc/economy-choices';
import { portableReserve } from '../../src/server/npc/cargo';
import type { Step } from '../../src/server/npc/decision';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('resident reserve editor saves cash and cargo policies and rejects inverted bounds', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-reserve-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Reserve owner'),
      initial = createWorld('reserve-rules', 'Reserve rules', account.id);
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
      npcBudgetNeedAllowance: 1000000,
      npcBudgetFuelThreshold: 0,
    });
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const bank = makeBuilding('bank', 'bank', 50, 50);
    initial.buildings = [bank];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, {
      x: 0,
      z: 0,
      y: 0,
      engine: false,
      hunger: 30000,
      thirst: 0,
      fuel: 0,
      inventory: { fish: 10, water: 10 },
      cash: 100000,
      bank: 50000,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const plannedDeposit = () => {
      const steps: Step[] = [];
      economyChoices(
        w(),
        p(),
        w().buildings,
        (_d, plan) => steps.push(...plan),
        (_b, plan) => plan,
      );
      const deposit = steps
        .flatMap((s) => (s.kind === 'act' ? [s.action] : []))
        .find((a) => a.type === 'bank' && a.direction === 'deposit');
      return deposit?.type === 'bank' ? deposit.amount : undefined;
    };
    expect(plannedDeposit()).toBe(30000);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'reserve-rules');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const edit = async () => {
        await page.keyboard.press('F10');
        await page.getByRole('button', { name: 'Rules', exact: true }).click();
      },
      close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const group = page.getByRole('group', {
        name: 'Resident cash and portable reserves',
        exact: true,
      }),
      patch = {
        npcCareCashFloor: 1234,
        npcBankCashFloor: 20000,
        npcBankDepositShare: 0.25,
        npcBankMinimumDeposit: 9,
        npcPortableWater: 2,
        npcPortableBread: 4,
        npcPortableMinimum: 1,
        npcPortableMaximum: 5,
        npcPortableNutrition: 20000,
        npcPortableEquipment: 2,
        npcFishingSurplus: 1,
        npcTradeFoodReserve: 4,
        npcTradeDrinkReserve: 3,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.npcBankCashFloor).toBe(20000);
    expect(plannedDeposit()).toBe(20000);
    expect(portableReserve('water', w())).toBe(2);
    expect(portableReserve('bread', w())).toBe(4);
    expect(portableReserve('fish', w())).toBe(3);
    expect(p().cash).toBe(100000);
    expect(p().bank).toBe(50000);
    expect(p().inventory).toEqual({ fish: 10, water: 10 });
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcCareCashFloor"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-cash-rules.png' });
    await group.locator('[name="npcTradeDrinkReserve"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-portable-rules.png' });
    await group.locator('[name="npcPortableMinimum"]').fill('6');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText(
      'Portable reserve minimum must not exceed its maximum',
    );
    expect(w().settings.npcPortableMinimum).toBe(1);
    expect(w().settings.npcPortableMaximum).toBe(5);
    expect(plannedDeposit()).toBe(20000);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: 'test-results/resident-reserve-refusal.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
