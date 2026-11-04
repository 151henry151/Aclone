// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { gameplayChoices } from '../../src/server/npc/farmer';
import type { ResidentState } from '../../src/server/npc/memory';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('discretionary budgets persist, change farm funding and refuse invalid values', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-discretionary-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('discretionary-rules', 'Discretionary rules', account.id);
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
    const shop = makeBuilding('farm', 'farm', 50, 0);
    Object.assign(shop, {
      owner: account.id,
      wage: 0,
      investment: 0,
      stock: {},
      buy: { flour: 100 },
      sell: {},
    });
    initial.buildings = [shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 20000,
      fuel: 100,
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
    const state: ResidentState = {
      playerId: account.id,
      world: initial.id,
      name: account.name,
      personality: 'Helpful',
      notebook: '',
      intent: '',
      cursor: 0,
      nextAt: 0,
      plan: [],
      index: 0,
      repeats: 0,
      until: 0,
      waitUntil: 0,
      status: 'Ready',
      errors: 0,
    };
    const funding = () =>
      gameplayChoices(w(), p(), state, 'farmer')
        .find((c) => c.description.startsWith('Fund seeds'))
        ?.plan.flatMap((s) =>
          s.kind === 'act' && s.action.type === 'investment' ? [s.action.amount] : [],
        )[0];
    expect(funding()).toBe(5000);
    const group = page.getByRole('group', {
      name: 'Resident cash and portable reserves',
      exact: true,
    });
    await edit();
    const patch = {
      npcPropertyCashReserve: 321,
      npcPaintCashThreshold: 30000,
      npcFarmFundingTillThreshold: 12000,
      npcFarmFundingCashThreshold: 100,
      npcFarmFundingAmount: 200,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcFarmFundingAmount).toBe(200);
    expect(funding()).toBe(200);
    expect(p().cash).toBe(20000);
    expect(w().buildings[0].investment).toBe(0);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcFarmFundingAmount"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/discretionary-budget-rules.png' });
    await group.locator('[name="npcFarmFundingAmount"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcFarmFundingAmount).toBe(0);
    expect(funding()).toBeUndefined();
    const invalid = group.locator('[name="npcFarmFundingAmount"]');
    await invalid.fill('-1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '0',
    );
    await page.screenshot({ path: 'test-results/discretionary-budget-invalid.png' });
    expect(w().settings.npcFarmFundingAmount).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcFarmFundingAmount"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
