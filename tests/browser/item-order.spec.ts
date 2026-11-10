// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('inventory and shop sort by availability/name while trades and stockroom preserve item identity', async ({
  page,
}) => {
  test.setTimeout(150000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-items-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  mkdirSync('output/item-order', { recursive: true });
  try {
    const { account, token } = app.universe.register('StockTester');
    const w = createWorld('stock-test', 'Ordered inventories', 'owner'),
      b = w.buildings.find((b) => b.kind === 'market')!;
    Object.assign(w, { buildings: [b], zones: [], script: '' });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    Object.assign(w.settings, {
      hungerRate: 0,
      thirstRate: 0,
      autoConsumeInventory: false,
      dayLength: 0,
      time: 43200,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: b.x,
      z: b.z + 12,
      cash: 1000000,
      vehicle: 5,
      inventory: { water: 2, bread: 2, fuel: 2 },
    });
    Object.assign(b, {
      sell: { water: 100, fuel: 100, bread: 100 },
      buy: { water: 200, fuel: 200, bread: 200 },
      stock: { water: 4, fuel: 0, bread: 4 },
      investment: 1000000,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'stock-test');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const discard = page.locator('.item-list [data-do="discard"]');
    await expect
      .poll(() => discard.evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.id)))
      .toEqual(['bread', 'fuel', 'water']);
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await close();
    await page.locator('#target button').click();
    const buys = page.locator('[data-do="trade"][data-direction="buy"]');
    await expect
      .poll(() => buys.evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.item)))
      .toEqual(['bread', 'water', 'fuel']);
    await page.locator('.trade-columns').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/item-order/shop.png' });
    await page.locator('[data-do="trade"][data-direction="buy"][data-item="bread"]').click();
    await expect.poll(() => p.inventory.bread).toBe(3);
    await page.locator('[data-do="trade"][data-direction="sell"][data-item="water"]').click();
    await expect.poll(() => p.inventory.water).toBe(1);
    await close();
    b.owner = p.id;
    b.government = false;
    await page.setViewportSize({ width: 430, height: 932 });
    await page.locator('#target button').click();
    await page.getByRole('button', { name: 'Stockroom', exact: true }).click();
    const form = page.locator('form[data-action="stock"]'),
      select = form.locator('select[name="item"]');
    await expect
      .poll(() =>
        select
          .locator('option')
          .evaluateAll((es) => es.slice(0, 3).map((e) => (e as HTMLOptionElement).value)),
      )
      .toEqual(['bread', 'fuel', 'water']);
    await select.selectOption('fuel');
    await form.locator('[name="quantity"]').fill('2');
    await page.waitForTimeout(1200);
    await expect(select).toHaveValue('fuel');
    await page.screenshot({ path: 'output/item-order/stockroom-phone.png' });
    await form.getByRole('button', { name: 'Transfer stock' }).click();
    await expect.poll(() => b.stock.fuel).toBe(2);
    expect(p.inventory.fuel ?? 0).toBe(0);
    await close();
    p.inventory = {};
    w.revision++;
    await page.keyboard.press('i');
    await expect(page.locator('#modal-host')).toContainText("You're not carrying any items.");
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
