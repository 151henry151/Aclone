// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { inputBidQuote } from '../../src/server/npc/business-policy';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('resident pricing editor saves quotes, supports zero ceiling and refuses inverted load bounds', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-pricing-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Pricing owner'),
      initial = createWorld('pricing-rules', 'Pricing rules', account.id);
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
      ownerOperation: false,
      activeWork: false,
    });
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const b = makeBuilding('bakery', 'bakery', 50, 50),
      supplier = makeBuilding('mill', 'mill', 70, 50);
    b.owner = account.id;
    b.stock = { flour: 0, bread: 0 };
    b.buy = { flour: 100 };
    b.sell = { bread: 4000 };
    b.wage = 100;
    b.investment = 100000;
    b.production = {
      skill: 'baker',
      seconds: 600,
      tier: 1,
      inputs: { flour: 2 },
      outputs: { bread: 3 },
    };
    supplier.stock = { flour: 500 };
    supplier.sell = { flour: 100 };
    initial.buildings = [b, supplier];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, { x: 0, z: 0, y: 0, engine: false, cash: 10000, inventory: {} });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      factory = () => w().buildings.find((v) => v.id === b.id)!,
      quote = () => inputBidQuote(w(), w().players[account.id], factory(), 'flour');
    expect(quote()?.price).toBe(200);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'pricing-rules');
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
      group = page.getByRole('group', { name: 'Resident pricing', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      npcHaulageMargin: 0.5,
      npcTravelTimeValue: 0,
      npcInputMinimumAllowance: 0,
      npcMaximumInputBid: 1000,
      npcBidReopenFraction: 1,
      npcWageMarginShare: 0.1,
      npcProductionPriceMultiplier: 1.5,
      npcMinimumOutputAsk: 25,
      npcSurplusMinimumStock: 10,
      npcSurplusCapacityShare: 0,
      npcPricingMinimumLoad: 1,
      npcPricingMaximumLoad: 12,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => quote()?.price).toBe(150);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcHaulageMargin"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-pricing-inputs.png' });
    await group.locator('[name="npcPricingMaximumLoad"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-pricing-outputs.png' });
    await group.locator('[name="npcMaximumInputBid"]').fill('0');
    await apply();
    await expect.poll(quote).toBeUndefined();
    expect(factory().buy.flour).toBe(100);
    expect(factory().stock).toEqual({ flour: 0, bread: 0 });
    expect(w().players[account.id].cash).toBe(10000);
    await close();
    await edit();
    await expect(group.locator('[name="npcMaximumInputBid"]')).toHaveValue('0');
    await group.locator('[name="npcPricingMinimumLoad"]').fill('13');
    await apply();
    await expect(page.locator('#toast')).toContainText(
      'Pricing minimum load must not exceed its maximum',
    );
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    expect(w().settings.npcPricingMinimumLoad).toBe(1);
    expect(quote()).toBeUndefined();
    await page.screenshot({ path: 'test-results/resident-pricing-refusal.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries({ ...patch, npcMaximumInputBid: 0 }))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
