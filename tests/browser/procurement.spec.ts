// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
import { refreshOrders } from '../../src/shared/procurement.ts';
test('mobile suppliers can inspect and fulfil a funded parish order', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-orders-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    const { account, token } = app.universe.register('Supplier');
    const w = app.worlds.get('puddlewick')!;
    refreshOrders(w);
    const p = addPlayer(w, account.id, account.name),
      order = w.procurement!.orders[0];
    const harbour = w.buildings.find((b) => b.id === w.procurement!.building)!;
    p.x = harbour.x;
    p.z = harbour.z + 12;
    p.inventory[order.item] = 4;
    app.store.saveWorld(w);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.locator('#brand-button').click();
    await page.getByRole('button', { name: 'Parish supply orders', exact: true }).click();
    const form = page.locator('form[data-action="fulfilOrder"]').first();
    await form.getByLabel('Quantity').fill('2');
    await form.getByRole('button').click();
    await expect.poll(() => order.delivered).toBe(2);
    await expect(form.getByLabel('Quantity')).toHaveValue('2');
    await page.screenshot({ path: 'test-results/parish-orders-mobile.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
