// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('government import rules publish local prices and sell from an empty shelf', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  // Pause autonomous restocking so the empty-shelf purchase itself is observable.
  const dir = mkdtempSync(join(tmpdir(), 'aclone-import-rules-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Import buyer');
    const initial = createWorld('puddlewick', 'Import rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      salesTax: 0,
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
    const shop = makeBuilding('parish-government-stores', 'market', 0, 0),
      port = makeBuilding('public', 'market', 100, 0),
      privateShop = makeBuilding('private', 'market', 200, 0);
    Object.assign(shop, {
      name: 'Government necessities',
      government: true,
      owner: 'treasury',
      stock: {},
      investment: 0,
      buy: {},
      sell: { water: 1250, bread: 10000, fuel: 10000 },
    });
    Object.assign(port, {
      government: true,
      owner: 'treasury',
      sell: { water: 1000, bread: 2000, fuel: 3000 },
      buy: { water: 100, bread: 200, fuel: 300 },
    });
    Object.assign(privateShop, {
      government: false,
      owner: 'other',
      sell: { fuel: 8000 },
      buy: {},
    });
    initial.buildings = [shop, port, privateShop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false, cash: 17000, inventory: {} });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id],
      b = () => w().buildings[0];
    const serverPort = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${serverPort}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    await edit();
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    const patch = {
      governmentImportPremium: 50,
      governmentWaterFloor: 2100,
      governmentBreadFloor: 4300,
      governmentFuelFloor: 17000,
      governmentImportBidMargin: 321,
    };
    for (const [key, value] of Object.entries(patch))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => b().sell.fuel).toBe(17000);
    expect(b().sell.water).toBe(2100);
    expect(b().sell.bread).toBe(4300);
    expect(b().stock.fuel ?? 0).toBe(0);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    for (const [key, value] of Object.entries(patch))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await group.locator('[name="governmentImportPremium"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/import-premium-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('e');
    const buy = page.locator('[data-do="trade"][data-item="fuel"][data-direction="buy"]'),
      row = page.locator('.trade-row').filter({ has: buy });
    await expect(row).toContainText('0 /');
    await expect(row).toContainText('1s 70d');
    await expect(row).toContainText('Emergency imports available');
    await buy.click();
    await expect.poll(() => p().inventory.fuel).toBe(1);
    expect(p().cash).toBe(0);
    expect(b().stock.fuel).toBe(0);
    expect(b().investment).toBe(3400);
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/import-empty-shelf.png' });
    await buy.click();
    await expect(page.locator('#toast')).toContainText('Not enough cash');
    expect(p().cash).toBe(0);
    expect(p().inventory.fuel).toBe(1);
    expect(b().stock.fuel).toBe(0);
    await page.screenshot({ path: 'test-results/import-cash-failure.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
