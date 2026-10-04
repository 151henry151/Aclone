// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { defaultCreator } from '../../src/shared/creator.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
test('desktop and phone can exchange mail, family invitations and an approved trade', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-social-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const left = await browser.newContext({ viewport: { width: 1280, height: 720 } }),
    right = await browser.newContext({ viewport: { width: 390, height: 844 } });
  left.setDefaultTimeout(15000);
  right.setDefaultTimeout(15000);
  try {
    const port = await app.listen(),
      seller = app.universe.register('Social seller'),
      buyer = app.universe.register('Social buyer');
    const w = app.worlds.get('puddlewick')!,
      a = addPlayer(w, seller.account.id, seller.account.name),
      b = addPlayer(w, buyer.account.id, buyer.account.name);
    a.x = b.x = 0;
    a.z = b.z = 17;
    a.inventory = { wheat: 20 };
    a.cash = b.cash = 10000;
    w.script = '';
    // Exercise social transactions, not two competing full-town GPU warmups.
    w.creator = defaultCreator();
    w.creator.scenery = false;
    w.creator.roads = false;
    w.buildings = [];
    const offline = addPlayer(w, 'offline', 'Offline friend');
    offline.online = false;
    app.store.saveWorld(w);
    for (const [ctx, token] of [
      [left, seller.token],
      [right, buyer.token],
    ] as const)
      await ctx.addInitScript((token) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      }, token);
    const s = await left.newPage(),
      t = await right.newPage();
    for (const p of [s, t]) {
      await p.bringToFront();
      await p.goto(`http://127.0.0.1:${port}`);
      await expect(p.locator('#world-hud')).toBeVisible({ timeout: 120000 });
      await p.keyboard.press('F9');
      await p.getByRole('button', { name: 'Mail, family & trades', exact: true }).click();
    }
    const mail = s.locator('#mail-compose');
    await mail.getByLabel('Resident name').fill(offline.name);
    await mail.getByLabel('Subject').fill('Delivery tomorrow');
    await mail.getByLabel('Letter', { exact: true }).fill('Wheat will be ready.');
    await mail.getByRole('button', { name: 'Send letter', exact: true }).click();
    await expect.poll(() => offline.mail?.length).toBe(1);
    await s.getByRole('button', { name: 'Family', exact: true }).click();
    await s.locator('#family-create').getByLabel('Family name').fill('Millers');
    await s.getByRole('button', { name: 'Create family', exact: true }).click();
    await expect(s.locator('#family-invite')).toBeVisible();
    await s.locator('#family-invite').getByLabel('Resident name').fill(b.name);
    await s.getByRole('button', { name: 'Invite resident', exact: true }).click();
    await t.getByRole('button', { name: 'Family', exact: true }).click();
    await t.getByRole('button', { name: 'Join', exact: true }).click();
    await expect.poll(() => b.family).toBe(a.family);
    await s.getByRole('button', { name: /^Trades \(/ }).click();
    const trade = s.locator('#trade-offer');
    await trade.getByLabel('Resident name').fill(b.name);
    await trade.getByRole('combobox', { name: /^Goods/ }).selectOption('wheat');
    await trade.getByLabel('Quantity').fill('5');
    await trade.getByLabel('Unit price in denarii').fill('6');
    await trade.getByRole('button', { name: 'Offer trade', exact: true }).click();
    await t.getByRole('button', { name: /^Trades \(/ }).click();
    await expect(t.getByText(/30d total/)).toBeVisible();
    await t.getByRole('button', { name: 'Accept trade', exact: true }).click();
    await expect.poll(() => b.inventory.wheat).toBe(5);
    expect(a.cash).toBe(13000);
    expect(b.cash).toBe(7000);
    await expect(t.getByText('No pending offers.')).toBeVisible();
    await t.screenshot({ path: 'test-results/social-phone.png' });
  } finally {
    await left.close();
    await right.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
