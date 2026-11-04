// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { householdBudget } from '../../src/server/npc/household';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('household editor applies forecast rules and refuses an invalid carried fraction', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-household-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Budget owner'),
      initial = createWorld('household-rules', 'Household rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 1,
      thirstRate: 2,
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
    const shop = makeBuilding('supplies', 'market', 50, 50);
    shop.sell = { bread: 100, water: 200, fuel: 300 };
    shop.stock = { bread: 100, water: 100, fuel: 100 };
    initial.buildings = [shop];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, {
      x: 0,
      z: 0,
      y: 0,
      engine: false,
      hunger: 15000,
      thirst: 15000,
      fuel: 0,
      inventory: { bread: 1, water: 1 },
      cash: 1000,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    expect(householdBudget(w(), p()).reserve).toBe(800);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'household-rules');
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
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const group = page.getByRole('group', { name: 'Resident household budget', exact: true }),
      patch = {
        npcHouseholdSeconds: 3600,
        npcBudgetNeedAllowance: 0,
        npcBudgetCarriedShare: 1,
        npcBudgetFuelThreshold: 0,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.npcHouseholdSeconds).toBe(3600);
    expect(householdBudget(w(), p()).reserve).toBe(300);
    expect(p().cash).toBe(1000);
    expect(p().inventory).toEqual({ bread: 1, water: 1 });
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/household-rules.png' });
    const share = group.locator('[name="npcBudgetCarriedShare"]');
    await share.fill('1.1');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(share).toBeFocused();
    expect(await share.evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow)).toBe(
      true,
    );
    expect(await share.evaluate((el) => (el as HTMLInputElement).validationMessage)).not.toBe('');
    expect(w().settings.npcBudgetCarriedShare).toBe(1);
    expect(householdBudget(w(), p()).reserve).toBe(300);
    await page.screenshot({ path: 'test-results/household-invalid-share.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(share).toHaveValue('1');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
