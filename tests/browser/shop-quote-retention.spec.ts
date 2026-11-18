// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('successful shop trades retain displayed quotes and drafts across deferred snapshots', async ({
  page,
}) => {
  test.setTimeout(150000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-items-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  mkdirSync('output/item-order', { recursive: true });
  try {
    const { account, token } = app.universe.register('StockTester');
    let w = createWorld('stock-test', 'Ordered inventories', 'owner'),
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
    let p = addPlayer(w, account.id, account.name);
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
    let hold = false;
    const queued: (string | Buffer)[] = [];
    let deliver: (data: string | Buffer) => void;
    const events: unknown[] = [];
    await page.routeWebSocket('**/*', (socket) => {
      const server = socket.connectToServer();
      deliver = (data) => socket.send(data);
      server.onMessage((data) => {
        const message = JSON.parse(String(data));
        if (message.type === 'result') events.push(message);
        if (hold) queued.push(data);
        else socket.send(data);
      });
      socket.onMessage((data) => {
        const message = JSON.parse(String(data));
        if (message.action?.type === 'trade') events.push(message);
        server.send(data);
      });
    });
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
    const water = page.locator('[data-do="trade"][data-direction="buy"][data-item="water"]');
    const quantity = page.locator('#trade-quantity');
    const button = await water.elementHandle();
    const input = await quantity.elementHandle();
    await expect(water).toHaveAttribute('data-price', '100');
    // Hold real ordered server messages until the next draft has focus. This
    // reproduces a successful result arriving while the player edits quantity.
    hold = true;
    await page.locator('[data-do="trade"][data-direction="sell"][data-item="water"]').click();
    await expect.poll(() => p.inventory.water).toBe(1);
    await expect
      .poll(() => queued.some((data) => JSON.parse(String(data)).type === 'result'))
      .toBe(true);
    await quantity.fill('3');
    await quantity.focus();
    b.sell.water = 150;
    w.revision++;
    hold = false;
    for (const data of queued) deliver!(data);
    await expect(page.locator('.trade-row').filter({ has: water })).toContainText('You have 1');
    await expect(quantity).toBeFocused();
    await expect(quantity).toHaveValue('3');
    await quantity.blur();
    // A visible marker proves the client applied a post-blur snapshot containing
    // the new server quote; observing a network frame alone would be too early.
    p.inventory.bread = 3;
    w.revision++;
    await expect(page.locator('[data-trade-carried][data-item="bread"]').first()).toHaveText(
      'You have 3',
    );
    events.push(
      await water.evaluate((el) => ({ displayedPrice: (el as HTMLElement).dataset.price })),
    );
    await test.info().attach('quote-message-order', {
      body: JSON.stringify(events, null, 2),
      contentType: 'application/json',
    });
    expect(await button!.evaluate((el) => el.isConnected)).toBe(true);
    expect(await input!.evaluate((el) => el.isConnected)).toBe(true);
    await expect(quantity).toHaveValue('3');
    await expect(water).toHaveAttribute('data-price', '100');
    const cash = p.cash;
    await water.click();
    await expect(page.locator('#toast')).toContainText('The price changed');
    w = app.worlds.get(w.id)!;
    b = w.buildings.find((shop) => shop.id === b.id)!;
    p = w.players[p.id];
    expect(p.inventory.water).toBe(1);
    expect(p.cash).toBe(cash);
    await expect(water).toHaveAttribute('data-price', '150');
    await quantity.fill('1');
    await page.screenshot({ path: 'output/item-order/shop-quote-retry.png' });
    await water.click();
    await expect.poll(() => p.inventory.water).toBe(2);
    expect(p.cash).toBe(cash - 150);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: expect.objectContaining({
            type: 'trade',
            direction: 'buy',
            item: 'water',
            quantity: 3,
            expectedPrice: 100,
          }),
        }),
        expect.objectContaining({
          action: expect.objectContaining({
            type: 'trade',
            direction: 'buy',
            item: 'water',
            quantity: 1,
            expectedPrice: 150,
          }),
        }),
      ]),
    );
    await test.info().attach('quote-refusal-and-retry', {
      body: JSON.stringify(events, null, 2),
      contentType: 'application/json',
    });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
