// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { retainedCapital } from '../../src/server/npc/business-policy';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('working-capital rules save zero reserves and reject a below-cost material multiplier', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-working-capital-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Capital owner'),
      initial = createWorld('capital-rules', 'Capital rules', account.id);
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
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const b = makeBuilding('market', 'market', 50, 50);
    b.owner = account.id;
    b.stock = {};
    b.investment = 100000;
    b.wage = 100;
    initial.buildings = [b];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, { x: 0, z: 0, y: 0, engine: false, cash: 10000, inventory: {} });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      business = () => w().buildings.find((v) => v.id === b.id)!,
      reserve = () => retainedCapital(w(), business());
    expect(reserve()).toBe(2000);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'capital-rules');
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
      close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      group = page.getByRole('group', { name: 'Resident business budgets', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      npcPayrollReserveBatches: 2,
      npcMinimumPayrolls: 4,
      npcBusinessCashFloor: 123,
      npcStartupBatches: 1,
      npcStartupMaterialMultiplier: 1.5,
      npcHayReserveItems: 5,
      npcHayCustomerStockLimit: 3,
      npcHayCustomerFundedItems: 11,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(reserve).toBe(400);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcPayrollReserveBatches"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-working-capital.png' });
    await group.locator('[name="npcHayCustomerFundedItems"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-hay-capital.png' });
    await group.locator('[name="npcMinimumPayrolls"]').fill('0');
    await group.locator('[name="npcBusinessCashFloor"]').fill('0');
    await apply();
    await expect.poll(reserve).toBe(0);
    expect(business().investment).toBe(100000);
    expect(business().stock).toEqual({});
    expect(w().players[account.id].cash).toBe(10000);
    await close();
    await edit();
    await expect(group.locator('[name="npcMinimumPayrolls"]')).toHaveValue('0');
    await expect(group.locator('[name="npcBusinessCashFloor"]')).toHaveValue('0');
    const multiplier = group.locator('[name="npcStartupMaterialMultiplier"]');
    await multiplier.fill('0.95');
    await apply();
    await expect(multiplier).toBeFocused();
    expect(
      await multiplier.evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow),
    ).toBe(true);
    expect(await multiplier.evaluate((el) => (el as HTMLInputElement).validationMessage)).not.toBe(
      '',
    );
    expect(w().settings.npcStartupMaterialMultiplier).toBe(1.5);
    await page.screenshot({ path: 'test-results/resident-capital-refusal.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries({
      ...patch,
      npcMinimumPayrolls: 0,
      npcBusinessCashFloor: 0,
    }))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
