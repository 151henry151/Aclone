// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';

test('tax rates are accessible remotely and shop totals follow quantity on desktop and mobile', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-taxes-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Tax tester');
    const w = createWorld('tax-test', 'Tax test', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    const b = makeBuilding('mill', 'mill', 0, 0);
    b.owner = 'someone-else';
    b.name = 'Tax test mill';
    b.buy = { wheat: 600 };
    b.sell = { flour: 1000 };
    b.stock.flour = 10;
    w.buildings = [b];
    w.settings.salesTax = 0.05;
    w.towns[0].x = w.towns[0].z = 0;
    w.towns[0].salesTax = 0.02;
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
    await expect(page.locator('#target')).toContainText(b.name, { timeout: 20000 });
    await page.getByRole('button', { name: 'World F9', exact: true }).click();
    await page.getByRole('button', { name: 'Taxes & rates', exact: true }).click();
    await expect(page.locator('[data-tax-overview]')).toContainText('Sales tax 7% included');
    await expect(page.locator('[data-tax-overview]')).toContainText('business keeps 93d');
    // Live tax changes refresh an open overview without reopening the menu.
    w.towns[0].salesTax = 0.03;
    await expect(page.locator('[data-tax-overview]')).toContainText('Sales tax 8% included');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.locator('#target').click();
    await page.locator('#trade-quantity').fill('5');
    const buy = page.locator('[data-trade-quote][data-side=sell]');
    await expect(buy).toContainText('you pay 50d total. Included tax 4d');
    await expect(page.locator('[data-trade-quote][data-side=buy]')).toContainText(
      'you receive 30d',
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(buy).toBeVisible();
    const bounds = await buy.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: innerWidth };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    await page.screenshot({ path: 'output/tax-trades-mobile.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
