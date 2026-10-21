// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
test('owners inspect market quotes, manage hiring and remove sale listings', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-prices-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Price tester');
    const w = createWorld('price-test', 'Price test', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    const b = makeBuilding('mill', 'mill', 0, 0);
    b.owner = p.id;
    b.forSale = true;
    b.wage = 2200; // Explicit saved owner quote, independent of catalogue defaults.
    b.name = 'My test mill';
    b.buy = { wheat: 600 };
    b.sell = { flour: 1250, wheat: 0 };
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
    await expect(page.getByRole('heading', { name: 'Your sale listings' })).toBeVisible();
    await expect(page.locator('[data-trade-quote][data-item=flour]')).toContainText(
      'Customer pays 12.5d',
    );
    await expect(page.locator('[data-do=trade]')).toHaveCount(0);
    await page.locator('#trade-quantity').fill('3');
    await expect(page.locator('[data-trade-quote][data-item=flour]')).toContainText(
      'Customer pays 37.5d',
    );
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Staffing & hiring' })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Maximum paid employees' }).fill('1');
    await page.getByRole('button', { name: 'Save hiring limit', exact: true }).click();
    await expect.poll(() => b.hiringLimit).toBe(1);
    // Native Enter in an admin field submits its form, rather than stealing focus for chat.
    await page.getByRole('spinbutton', { name: 'Maximum paid employees' }).fill('2');
    await page.keyboard.press('Enter');
    await expect.poll(() => b.hiringLimit).toBe(2);
    await expect(page.getByRole('heading', { name: 'Estimated production margins' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove from sale', exact: true }).click();
    await expect.poll(() => b.forSale).toBe(false);
    await expect(page.getByRole('button', { name: 'Remove from sale', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'List property for sale', exact: true }).click();
    await expect.poll(() => b.forSale).toBe(true);

    await page.screenshot({ path: 'test-results/owner-management.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
