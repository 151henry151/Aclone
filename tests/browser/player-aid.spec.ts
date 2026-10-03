// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} gives cash and refuels a neighbour without losing drafts`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-aid-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    try {
      const { account, token } = app.universe.register('Helpful pilot');
      const w = createWorld('help', 'Helpful parish', account.id);
      w.script = '';
      w.settings.hungerRate = w.settings.thirstRate = 0;
      const p = addPlayer(w, account.id, account.name),
        b = addPlayer(w, 'neighbour', 'Bo <b>Oak</b>');
      p.cash = 10000;
      p.inventory.fuel = 2;
      p.x = 30;
      p.z = 30;
      b.x = 35;
      b.z = 30;
      b.y = p.y;
      b.online = true;
      b.fuel = 0;
      b.cash = 500;
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
      await expect(page.locator('#players')).toContainText(b.name);
      if (mobile) {
        await page.locator('[data-do=mobile-actions]').tap();
        await page.getByRole('button', { name: 'Players & roadside help', exact: true }).tap();
        await page.locator('#modal-host [data-do=player]').tap();
      } else await page.locator('#players [data-do=player]').click();
      const dialog = page.getByRole('dialog'),
        form = page.locator('#money-gift-form');
      await expect(dialog).toContainText(b.name);
      await expect(form.locator('b')).toHaveCount(0);
      await form.locator('input').fill('25.75');
      await form.getByRole('button').click();
      await expect.poll(() => b.cash).toBe(3075);
      await expect.poll(() => p.cash).toBe(7425);
      await expect(form.locator('input')).toHaveValue('25.75');
      await expect(page.locator('#aid-cash')).toContainText('74.25d');
      const refuel = page.locator('[data-do=refuelPlayer]');
      await expect(refuel).toBeEnabled();
      await refuel.click();
      await expect.poll(() => p.inventory.fuel).toBe(1);
      await expect.poll(() => b.fuel).toBeGreaterThan(7.9);
      await expect(page.locator('#refuel-status')).toContainText('You carry 1 Fuel');
      await page.screenshot({
        path: `test-results/player-aid-${mobile ? 'phone' : 'desktop'}.png`,
      });
      // Dynamic availability changes do not rebuild/reset a partially entered gift.
      await form.locator('input').fill('12.34');
      b.x = 200;
      await expect(refuel).toBeDisabled();
      await expect(page.locator('#refuel-status')).toContainText('15 metres');
      await expect(form.locator('input')).toHaveValue('12.34');
      w.settings.allowMoneyGifts = false;
      await expect(form.getByRole('button')).toBeDisabled();
      await expect(page.locator('#gift-status')).toContainText('disabled');
      w.settings.allowMoneyGifts = true;
      b.online = false;
      await expect(page.locator('#aid-location')).toContainText('left the parish');
      await expect(form.getByRole('button')).toBeDisabled();
      await expect(form.locator('input')).toHaveValue('12.34');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
