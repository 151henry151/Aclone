// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { journeyEstimate } from '../../src/server/npc/projects';
import { drivePlan } from '../../src/server/npc/travel';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('journey budgets persist, change estimates and refuelling plans and refuse invalid values', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-journey-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('journey-rules', 'Journey budgets', account.id);
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
      stock: { fuel: 100 },
      buy: { flour: 100 },
      sell: { fuel: 1000 },
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
    initial.vehicleTuning = { 0: { speed: 10, fuel: 0.2 } };
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 20000,
      hunger: 0,
      thirst: 0,
      fuel: 15,
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
    const estimate = () => journeyEstimate(w(), p(), [{ x: 100, z: 10 }]);
    const buys = () =>
      drivePlan(w(), p()).some(
        (s) => s.kind === 'act' && s.action.type === 'trade' && s.action.item === 'fuel',
      );
    expect(estimate()).toEqual({ seconds: 25, cost: 625 });
    expect(buys()).toBe(false);
    const group = page.getByRole('group', {
      name: 'Resident journey budgets',
      exact: true,
    });
    await edit();
    const patch = {
      npcJourneyDistanceMultiplier: 2,
      npcJourneySpeedFraction: 0.5,
      npcJourneyFuelFallbackPrice: 1200,
      npcEquipmentPaybackLoads: 3,
      npcDriveFuelThreshold: 20,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcDriveFuelThreshold).toBe(20);
    expect(estimate()).toEqual({ seconds: 40, cost: 1000 });
    expect(buys()).toBe(true);
    expect(p().cash).toBe(20000);
    expect(w().buildings[0].investment).toBe(0);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcJourneyDistanceMultiplier"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/journey-budget-rules.png' });
    await group.locator('[name="npcDriveFuelThreshold"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/journey-budget-last-fields.png' });
    await group.locator('[name="npcDriveFuelThreshold"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcDriveFuelThreshold).toBe(0);
    expect(buys()).toBe(false);
    expect(p().fuel).toBe(15);
    expect(p().inventory.fuel ?? 0).toBe(0);
    const invalid = group.locator('[name="npcDriveFuelThreshold"]');
    await invalid.fill('-1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '0',
    );
    await page.screenshot({ path: 'test-results/journey-budget-invalid.png' });
    expect(w().settings.npcDriveFuelThreshold).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcDriveFuelThreshold"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
