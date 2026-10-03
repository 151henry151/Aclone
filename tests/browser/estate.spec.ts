// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding, money } from '../../src/shared/simulation.ts';
import { propertyQuote, PROPERTY_YEAR } from '../../src/shared/property.ts';

test('an open property quote follows current equity and annual discounts without resetting trade quantity', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-estate-ui-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Estate visitor');
    const w = createWorld('estate-ui', 'Estate UI', account.id);
    w.script = '';
    w.settings.estateEquityShare = 0.9;
    w.settings.estateAnnualDiscount = 0.05;
    const p = addPlayer(w, account.id, account.name);
    p.cash = 1000000;
    p.x = 0;
    p.z = 10;
    const b = makeBuilding('mill', 'mill', 0, 0);
    b.estate = { base: b.price, since: 0 };
    b.stock = { flour: 20 };
    b.sell.flour = 1;
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
    await expect(page.locator('#target')).toContainText(b.name, { timeout: 20000 });
    await page.locator('#target').click();
    const quote = page.locator('[data-property-quote] b');
    await expect(quote).toHaveText(money(propertyQuote(w, b).total));
    await page.locator('#trade-quantity').fill('5');
    await page.locator('[data-do=trade][data-item=flour][data-direction=buy]').click();
    await expect.poll(() => b.stock.flour).toBe(15);
    await expect(quote).toHaveText(money(propertyQuote(w, b).total));
    w.time = PROPERTY_YEAR + 100;
    await expect(quote).toHaveText(money(propertyQuote(w, b).total));
    await expect(page.locator('#trade-quantity')).toHaveValue('5');
    await expect(page.locator('[data-property-quote]')).toContainText(
      '1 years unclaimed, 5% discount',
    );
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
