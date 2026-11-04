// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { refreshOrders } from '../../src/shared/procurement';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('suppliers see configured share windows and empty/disabled states', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-order-rules-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Supplier');
    const initial = createWorld('orders-ui', 'Supply rules', account.id);
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
      parishOrderBudget: 120000,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const harbour = makeBuilding('harbour', 'market', 0, 0);
    harbour.government = true;
    initial.buildings = [harbour];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false, inventory: {} });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'orders-ui');
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
    for (const [key, value] of Object.entries({
      parishOrderPeriod: 120,
      parishOrderShare: 0.25,
      parishOrderShareWindow: 0.25,
    }))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await page.locator('[name="parishOrders"]').check();
    w().time = 1200;
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().procurement?.expiresAt).toBe(1320);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    for (const [key, value] of Object.entries({
      parishOrderPeriod: 120,
      parishOrderShare: 0.25,
      parishOrderShareWindow: 0.25,
    }))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/procurement-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Parish supply orders', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('first 0.5 minutes');
    await expect(dialog).toContainText('25% of an order');
    const order = () => w().procurement!.orders[0],
      form = page.locator('[data-action="fulfilOrder"]').first();
    const early = Math.ceil(order().quantity * 0.25);
    p().inventory[order().item] = order().quantity;
    await expect(form.getByRole('button')).toBeEnabled();
    await form.getByLabel('Quantity').fill(String(early));
    await form.getByRole('button').click();
    await expect.poll(() => order().delivered).toBe(early);
    await expect(form.getByRole('button')).toBeDisabled();
    await expect(dialog).toContainText('Your remaining allowance: 0');
    await page.screenshot({ path: 'test-results/procurement-share-exhausted.png' });
    await form.getByLabel('Quantity').fill('1');
    w().time = 1230;
    await expect(form.getByRole('button')).toBeEnabled();
    await expect(form.getByLabel('Quantity')).toHaveValue('1');
    await form.getByRole('button').click();
    await expect.poll(() => order().delivered).toBe(early + 1);
    w().settings.parishOrders = false;
    await expect(dialog).toContainText('disabled in this world');
    await page.screenshot({ path: 'test-results/procurement-disabled.png' });
    w().buildings[0].government = false;
    w().time = w().procurement!.expiresAt + 1;
    w().settings.parishOrders = true;
    refreshOrders(w());
    await expect(dialog).toContainText('No current orders');
    await expect(page.locator('[data-action="fulfilOrder"]')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/procurement-empty.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
