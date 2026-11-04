// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { fuelCapacity } from '../../src/shared/tractors';
import { waitForWorld } from './fixtures/ready';

test('owners price and pump free; customers fill capped tanks and buy inventory from offline tankers, with empty and disabled states', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-fuel-sales-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const owner = app.universe.register('Fuel supplier'),
      buyer = app.universe.register('Fuel buyer');
    const w = createWorld('fuel-sales', 'Fuel sales', owner.account.id);
    w.script = '';
    w.buildings = [];
    w.towns = [];
    w.roads = [];
    Object.assign(w.settings, {
      mapSize: 500,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      salesTax: 0.1,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    const p = addPlayer(w, owner.account.id, owner.account.name),
      q = addPlayer(w, buyer.account.id, buyer.account.name);
    for (const person of [p, q])
      Object.assign(person, {
        x: 0,
        z: -40,
        y: 3,
        heading: 0,
        vehicle: 0,
        inventory: {},
        cash: 100000,
        bank: 1000,
        fuel: 0,
        engine: false,
        speed: 0,
      });
    q.fuel = fuelCapacity(q, w) - 3;
    const t = {
      id: 'trailer-1',
      kind: 'fuel' as const,
      owner: p.id,
      x: 0,
      z: -46,
      heading: 0,
      cargo: { fuel: 8 },
      sellPrice: 0,
    };
    w.trailers = { [t.id]: t };
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        if (!localStorage.getItem('aclone.pilot')) localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'fuel-sales');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token: owner.token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const panel = page.locator('.fuel-tanker-sales');
    await expect(panel).toContainText('Public sales closed');
    const price = panel
      .locator('form')
      .filter({ has: page.locator('[name="operation"][value="price"]') });
    await price.locator('[name="priceDenarii"]').fill('50');
    await price.getByRole('button').click();
    await expect.poll(() => t.sellPrice).toBe(5000);
    const pump = panel
      .locator('form')
      .filter({ has: page.locator('[name="operation"][value="pump"]') });
    await pump.getByRole('button').click();
    await expect.poll(() => p.fuel).toBe(8);
    expect(p.cash).toBe(100000);
    expect(t.cargo.fuel).toBe(7);
    await page.screenshot({ path: 'test-results/fuel-owner-free.png' });
    await page.evaluate((token) => localStorage.setItem('aclone.pilot', token), buyer.token);
    await page.reload();
    await waitForWorld(page);
    await expect.poll(() => p.online).toBe(false);
    await page.keyboard.press('i');
    await expect(panel).toContainText('Offline owner');
    await pump.locator('[name="quantity"]').fill('2');
    await pump.getByRole('button').click();
    await expect.poll(() => q.fuel).toBe(fuelCapacity(q, w));
    expect(t.cargo.fuel).toBe(6);
    expect(p.bank).toBe(5500);
    expect(q.cash).toBe(95000);
    await expect(pump.getByRole('button')).toBeDisabled();
    const purchase = panel
      .locator('form')
      .filter({ has: page.locator('[name="operation"][value="buy"]') });
    await purchase.locator('[name="quantity"]').fill('2');
    await purchase.getByRole('button').click();
    await expect.poll(() => q.inventory.fuel).toBe(2);
    expect(t.cargo.fuel).toBe(4);
    expect(p.bank).toBe(14500);
    await page.screenshot({ path: 'test-results/fuel-offline-sales.png' });
    t.cargo.fuel = 0;
    await expect(panel).toContainText('0 Fuel available');
    await expect(purchase.getByRole('button')).toBeDisabled();
    await page.screenshot({ path: 'test-results/fuel-empty.png' });
    t.cargo.fuel = 4;
    t.sellPrice = 0;
    await expect(panel).toContainText('Public sales closed');
    await expect(purchase.getByRole('button')).toBeDisabled();
    await page.screenshot({ path: 'test-results/fuel-closed.png' });
    await page.evaluate((token) => localStorage.setItem('aclone.pilot', token), owner.token);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="fuelTankerSales"]').uncheck();
    await rules.locator('[name="fuelTankerTransactionLimit"]').fill('2');
    await rules.locator('[name="refuelRange"]').fill('10');
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.fuelTankerSales).toBe(false);
    expect(w.settings.fuelTankerTransactionLimit).toBe(2);
    expect(w.settings.refuelRange).toBe(10);
    await rules.locator('[name="fuelUnitsPerItem"]').focus();
    await rules
      .getByRole('group', { name: 'Roadside fuel', exact: true })
      .evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await expect(rules.locator('[name="fuelUnitsPerItem"]')).toBeInViewport();
    await page.screenshot({ path: 'test-results/fuel-rules.png' });
    t.sellPrice = 5000;
    await page.evaluate((token) => localStorage.setItem('aclone.pilot', token), buyer.token);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('i');
    await expect(panel).toContainText('Roadside tanker sales are disabled');
    await expect(purchase.getByRole('button')).toBeDisabled();
    await page.screenshot({ path: 'test-results/fuel-sales-disabled.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
