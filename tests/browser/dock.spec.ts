// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, terrainHeight } from '../../src/shared/simulation.ts';
import { dockHeight } from '../../src/shared/dock.ts';

for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} dock supports driving and direct floating fishing controls`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-dock-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    try {
      const { account, token } = app.universe.register('Dock visitor');
      const w = createWorld('dock-preview', 'Puddlewick', account.id);
      w.script = '';
      w.settings.dayLength = 0;
      w.settings.time = 43200;
      const p = addPlayer(w, account.id, account.name);
      p.x = 20;
      p.z = 134;
      p.y = terrainHeight(w, p.x, p.z);
      p.heading = 0;
      p.inventory.fish = 0;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      await page.addInitScript(
        ({ token, world, quality }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', world);
          localStorage.setItem('aclone.quality', quality);
        },
        { token, world: w.id, quality: process.env.TEST_GPU === '1' ? 'high' : 'low' },
      );
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(page.locator('#target')).toContainText('Fishing dock');
      const activate = async (selector: string) =>
        mobile ? page.locator(selector).tap() : page.locator(selector).click();
      if (!mobile) {
        // A real scene click hits the dock, even after scenery meshes are merged.
        await page.keyboard.press('c');
        await page.mouse.move(700, 380);
        await page.mouse.down();
        await page.mouse.move(700, 420, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
        // Center overlay would intercept this ray, so use the clear right half of the deck.
        await page.mouse.click(950, 500);
        await expect(page.getByRole('dialog', { name: 'Fishing dock', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close dialog' }).click();
        for (const key of ['e', 'Control']) {
          await page.keyboard.press(key);
          await expect(
            page.getByRole('dialog', { name: 'Fishing dock', exact: true }),
          ).toBeVisible();
          await page.getByRole('button', { name: 'Close dialog' }).click();
        }
        await page.keyboard.down('w');
        await expect.poll(() => p.z, { timeout: 15000 }).toBeGreaterThan(148);
        await page.keyboard.up('w');
        expect(p.y).toBeGreaterThanOrEqual(dockHeight(w) - 0.01);
      } else {
        await activate('#target button');
        await expect(page.getByRole('dialog', { name: 'Fishing dock', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Close dialog' }).click();
      }
      await expect(page.locator('#fishing-cast')).toBeVisible();
      await activate('#fishing-cast');
      await expect.poll(() => p.game).toBe('fishing');
      expect(p.y).toBe(dockHeight(w));
      await expect(page.locator('#fishing-stop')).toBeVisible();
      await expect(page.locator('#fishing-reel')).toBeDisabled();
      p.fishAt = w.time;
      p.fishUntil = w.time + 30;
      await expect(page.locator('#fishing-reel')).toBeEnabled();
      const controls = page.locator('#fishing-control');
      expect(await controls.evaluate((e) => e.closest('.chat-panel'))).toBeNull();
      const box = (await controls.boundingBox())!;
      const view = page.viewportSize()!;
      expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(2);
      await page.screenshot({
        path: `test-results/dock-fishing-${mobile ? 'phone' : 'desktop'}.png`,
      });
      await activate('#fishing-reel');
      await expect.poll(() => p.inventory.fish).toBe(1);
      await activate('#fishing-stop');
      await expect.poll(() => p.game).toBeUndefined();
      await expect(page.locator('#fishing-reel')).toBeHidden();
      await expect(page.locator('#fishing-cast')).toBeVisible();
      p.inventory.tackle = 0;
      await expect(page.locator('#fishing-cast')).toBeDisabled();
      await expect(page.locator('#fishing-status')).toContainText('Fishing tackle');
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
