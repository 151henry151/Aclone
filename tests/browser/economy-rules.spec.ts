// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { FISHING_BOAT } from '../../src/shared/boats';
import { waitForWorld } from './fixtures/ready';

test('economy rules reach price editing, capped sales, rejection and empty goods states', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-economy-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Economy owner');
    const initial = createWorld('economy-ui', 'Economy rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const own = makeBuilding('own', 'bakery', 0, 0),
      shop = makeBuilding('visitor', 'bakery', 80, 0);
    own.name = 'Owner bakery';
    shop.name = 'Visitor bakery';
    own.owner = account.id;
    shop.owner = 'neighbour';
    shop.buy = { flour: 50 };
    shop.sell = {};
    shop.stock = { flour: 0 };
    shop.investment = 1000000;
    initial.buildings = [own, shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      vehicle: 0,
      engine: false,
      inventory: { flour: 7 },
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const p = () => w().players[account.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'economy-ui');
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
    await edit();
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    await group.locator('[name="minimumBuyPrice"]').fill('50');
    await group.locator('[name="transactionItemLimit"]').fill('3');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.transactionItemLimit).toBe(3);
    await page.keyboard.press('Escape');
    await edit();
    await expect(group.locator('[name="minimumBuyPrice"]')).toHaveValue('50');
    await expect(group.locator('[name="transactionItemLimit"]')).toHaveValue('3');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/economy-rules.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    const prices = page.locator('[data-price-editor]');
    await prices.locator('[name="item"]').selectOption('flour');
    await prices.locator('[name="side"]').selectOption('buy');
    await expect(prices.locator('[name="priceDenarii"]')).toHaveAttribute('min', '0.5');
    await prices.locator('[name="priceDenarii"]').fill('0.5');
    await prices.getByRole('button', { name: 'Save trading settings', exact: true }).click();
    await expect.poll(() => w().buildings[0].buy.flour).toBe(50);
    await expect(prices.locator('[data-saved-price]')).toContainText('0.5d');
    await page.keyboard.press('Escape');
    p().x = 80;
    w().trailers = {
      test: {
        id: 'test',
        owner: account.id,
        kind: 'box',
        x: 80,
        z: 16,
        heading: 0,
        attached: account.id,
        cargo: { flour: 1 },
      },
    };
    await expect(page.locator('#target')).toContainText(shop.name);
    await page.keyboard.press('e');
    const sell = page.locator('[data-do="sellAll"][data-item="flour"]');
    await expect(page.locator('#trade-quantity')).toHaveAttribute('max', '3');
    await expect(sell).toHaveText('Sell max (3)');
    await expect(page.locator('form[data-action="trade"] [name="quantity"]')).toHaveAttribute(
      'max',
      '3',
    );
    await page.locator('form[data-action="trade"] [name="quantity"]').fill('1');
    await page.getByRole('button', { name: 'Sell from trailer', exact: true }).click();
    await expect.poll(() => w().trailers?.test.cargo.flour ?? 0).toBe(0);
    await expect(page.getByRole('dialog')).toContainText('3-item trade limit');
    const cash = p().cash;
    await page.locator('#trade-quantity').fill('4');
    await page.locator('[data-do="trade"][data-item="flour"][data-direction="sell"]').click();
    await expect(page.locator('#toast')).toContainText('Invalid number');
    expect(p().cash).toBe(cash);
    expect(p().inventory.flour).toBe(7);
    await page.locator('#trade-quantity').fill('3');
    await sell.click();
    await expect.poll(() => p().inventory.flour).toBe(4);
    await sell.click();
    await expect.poll(() => p().inventory.flour).toBe(1);
    await sell.click();
    await expect.poll(() => p().inventory.flour ?? 0).toBe(0);
    await expect(sell).toBeDisabled();
    await expect(page.getByRole('dialog')).toContainText('You have none to sell');
    await page.screenshot({ path: 'test-results/economy-empty-goods.png' });
    await page.keyboard.press('Escape');
    await edit();
    await group.locator('[name="minimumBuyPrice"]').fill('200');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.minimumBuyPrice).toBe(200);
    await page.keyboard.press('Escape');
    p().inventory.flour = 1;
    await page.keyboard.press('e');
    await expect(sell).toBeDisabled();
    await page.locator('[data-do="trade"][data-item="flour"][data-direction="sell"]').click();
    await expect(page.locator('#toast')).toContainText('does not trade');
    expect(p().inventory.flour).toBe(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F9');
    await page.locator('[data-do="social"]').click();
    await page.locator('[data-do="social-tab"][data-id="trades"]').click();
    await expect(page.locator('#trade-offer [name="quantity"]')).toHaveAttribute('max', '3');
    await expect(page.getByRole('dialog')).toContainText('No pending offers');
    await page.keyboard.press('Escape');
    Object.assign(p(), { vehicle: FISHING_BOAT, x: 150, boatStores: {}, inventory: { water: 3 } });
    await page.keyboard.press('i');
    await expect(page.locator('#boat-store-quantity')).toHaveAttribute('max', '3');
    await page.locator('#boat-store-quantity').fill('3');
    await page.locator('[data-do="expedition"][data-id="store"][data-item="water"]').click();
    await expect.poll(() => p().boatStores?.water).toBe(3);
    await page.screenshot({ path: 'test-results/economy-boat-store.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
