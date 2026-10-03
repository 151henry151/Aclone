// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';

for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} shows offline building owners and a centered fishing control`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-fishing-owners-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    try {
      const { account, token } = app.universe.register('Fishing visitor');
      const w = createWorld('fishing-owners', 'Fishing owners', account.id);
      w.script = '';
      w.settings.hungerRate = w.settings.thirstRate = 0;
      const p = addPlayer(w, account.id, account.name);
      const owner = addPlayer(w, 'offline-owner', 'Miriam <b>Oak</b>');
      owner.online = false;
      const mill = w.buildings.find((b) => b.kind === 'mill')!;
      mill.owner = owner.id;
      mill.government = false;
      p.x = mill.x;
      p.z = mill.z + 13;
      p.inventory.tackle = 1;
      p.inventory.fish = 0;
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
      await expect(page.locator('#target')).toContainText(mill.name);
      const activate = async (selector: string) =>
        mobile ? page.locator(selector).tap() : page.locator(selector).click();
      await activate('#target button');
      await expect(page.locator('[data-building-owner]')).toHaveText(owner.name);
      await expect(page.locator('[data-building-owner] b')).toHaveCount(0);
      // Live facts update without rebuilding forms, even for absent owners.
      owner.name = 'Miriam Oak';
      await expect(page.locator('[data-building-owner]')).toHaveText('Miriam Oak');
      mill.owner = p.id;
      await expect(page.locator('[data-building-owner]')).toHaveText(p.name);
      await page.getByRole('button', { name: 'Close dialog' }).click();

      if (mobile) await activate('[data-do=mobile-actions]');
      await page.getByRole('button', { name: 'Activities', exact: true }).click();
      await page.getByRole('button', { name: 'Cast a line', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const reel = page.locator('#fishing-reel');
      await expect(reel).toBeVisible();
      await expect(reel).toBeDisabled();
      const box = (await page.locator('#fishing-control').boundingBox())!;
      const view = page.viewportSize()!;
      expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(view.height * 0.15);
      p.fishAt = w.time;
      // Keep the bite open through software-renderer screenshots; timing is covered in simulation tests.
      p.fishUntil = w.time + 300;
      await expect(reel).toBeEnabled();
      await expect(page.locator('#fishing-status')).toHaveText('Fish! Reel in now.');
      await page.screenshot({ path: `test-results/fishing-${mobile ? 'phone' : 'desktop'}.png` });
      await activate('#fishing-reel');
      await expect.poll(() => p.inventory.fish).toBe(1);
      await expect(reel).toBeDisabled();
      // Missed bites return to waiting; leaving fishing removes the control.
      p.fishAt = w.time - 10;
      p.fishUntil = w.time - 2;
      await expect(page.locator('#fishing-status')).toHaveText('Waiting for a bite…');
      if (mobile) await activate('[data-do=mobile-actions]');
      await page.getByRole('button', { name: 'Activities', exact: true }).click();
      await page.getByRole('button', { name: 'Leave current activity' }).click();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await expect(reel).toBeHidden();
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
