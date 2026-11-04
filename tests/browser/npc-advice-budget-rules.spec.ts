// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { lifeBriefing } from '../../src/server/npc/strategy';
import { adaptiveChoices } from '../../src/server/npc/adaptive';
import type { ResidentState } from '../../src/server/npc/memory';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('living advice and lodging suggestions persist without changing booked rates', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-advice-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('advice-rules', 'Living advice rules', account.id);
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
      stock: { bread: 100, water: 100 },
      buy: { flour: 100 },
      sell: { bread: 2000, water: 3000 },
    });
    const buyer = makeBuilding('buyer', 'hotel', 0, 0);
    Object.assign(buyer, {
      owner: account.id,
      lodging: { open: true, rate: 200, guests: {} },
      investment: 100000,
      buy: {},
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
      skills: ['innkeeper'],
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
    const advice = () => lifeBriefing(w(), p()).survival.suggestedLivingCash;
    const offer = () =>
      adaptiveChoices(w(), p(), state).find((c) => /for guests at/.test(c.description))
        ?.description;
    expect(advice()).toBe(24000);
    expect(offer()).toContain('at 600 per real hour');
    const group = page.locator('body');
    await edit();
    const patch = {
      npcAdviceCashFloor: 1234,
      npcAdviceMealItems: 2,
      npcAdviceDrinkItems: 1,
      npcLodgingOfferRate: 800,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcLodgingOfferRate).toBe(800);
    expect(advice()).toBe(7000);
    expect(offer()).toContain('at 800 per real hour');
    expect(w().buildings[1].lodging!.rate).toBe(200);
    expect(p().cash).toBe(20000);
    expect(w().buildings[0].investment).toBe(0);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcAdviceCashFloor"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/advice-budget-rules.png' });
    await group.locator('[name="npcLodgingOfferRate"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/advice-budget-last-fields.png' });
    for (const key of Object.keys(patch)) await group.locator(`[name="${key}"]`).fill('0');
    await apply();
    await expect.poll(() => w().settings.npcLodgingOfferRate).toBe(0);
    expect(advice()).toBe(0);
    expect(offer()).toContain('at 0 per real hour');
    expect(w().buildings[1].lodging!.rate).toBe(200);
    const invalid = group.locator('[name="npcLodgingOfferRate"]');
    await invalid.fill('-1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '0',
    );
    await page.screenshot({ path: 'test-results/advice-budget-invalid.png' });
    expect(w().settings.npcLodgingOfferRate).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcLodgingOfferRate"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
