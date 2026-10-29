// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';

test('owners save bulk tiers and farm staff rules through the actual building menus', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-business-controls-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Farm owner');
    const w = createWorld('business-ui', 'Business UI', account.id);
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    p.skills = ['farmer'];
    const b = makeBuilding('farm', 'farm', 0, 0);
    b.owner = p.id;
    b.government = false;
    b.investment = 100000;
    w.buildings = [b];
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#target')).toContainText(b.name, { timeout: 30000 });
    await page.locator('#target').click();
    const policy = page.locator('[data-farm-policy]');
    for (const box of await policy.locator('input[name="crop"]').all()) await box.uncheck();
    await policy.getByLabel('Wheat', { exact: true }).check();
    await policy.locator('[name="dailyLimit"]').fill('20');
    await policy.locator('[name="reserve"]').fill('100');
    await policy.getByRole('button', { name: 'Save staff rules' }).click();
    await expect
      .poll(() => b.farmPolicy)
      .toEqual({ crops: ['wheat'], dailyLimit: 2000, reserve: 10000 });
    await expect(policy.locator('[data-farm-policy-status]')).toContainText('Wheat');
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    const bulk = page.locator('[data-bulk-discounts]');
    await expect(bulk.getByLabel('Level 1 quantity', { exact: true })).toBeDisabled();
    await bulk.getByLabel('Discount policy').selectOption('custom');
    for (let i = 1; i <= 5; i++) {
      await bulk.getByLabel(`Level ${i} quantity`, { exact: true }).fill('');
      await bulk.getByLabel(`Level ${i} discount`, { exact: true }).fill('');
    }
    await bulk.getByLabel('Level 1 quantity', { exact: true }).fill('25');
    await bulk.getByLabel('Level 1 discount', { exact: true }).fill('4');
    await bulk.getByRole('button', { name: 'Save bulk discounts' }).click();
    await expect.poll(() => b.bulkDiscounts).toEqual([{ quantity: 25, percent: 4 }]);
    await expect(bulk.locator('[data-bulk-saved]')).toContainText('25+ items: 4%');
    await bulk.getByLabel('Discount policy').selectOption('off');
    await expect(bulk.getByLabel('Level 1 quantity', { exact: true })).toBeDisabled();
    await bulk.getByRole('button', { name: 'Save bulk discounts' }).click();
    await expect.poll(() => b.bulkDiscounts).toEqual([]);
    b.owner = 'other';
    addPlayer(w, 'other', 'Other owner');
    b.bulkDiscounts = [{ quantity: 25, percent: 4 }];
    b.sell.wheat = 100;
    b.stock.wheat = 100;
    p.cash = 100000;
    p.inventory = {};
    await expect(page.locator('#trade-quantity')).toBeVisible();
    await page.locator('#trade-quantity').fill('25');
    const purchase = page.locator('[data-do="trade"][data-item="wheat"][data-direction="buy"]');
    await expect(purchase).toHaveAttribute('data-total', '2400');
    await expect(
      page.locator('[data-trade-quote][data-item="wheat"][data-side="sell"]'),
    ).toContainText('Bulk discount 4%');
    await purchase.click();
    await expect.poll(() => p.inventory.wheat).toBe(25);
    expect(p.cash).toBe(97600);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
