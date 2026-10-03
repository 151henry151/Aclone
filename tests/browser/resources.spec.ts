// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, terrainHeight, act } from '../../src/shared/simulation.ts';
import { resourceNodes } from '../../src/shared/resources.ts';

for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} gathers all nearby resource types directly from the HUD`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-gather-hud-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    try {
      const { account, token } = app.universe.register('Gathering visitor');
      const w = createWorld('gather-hud', 'Puddlewick', account.id);
      w.script = '';
      w.settings.dayLength = 0;
      w.settings.time = 43200;
      const p = addPlayer(w, account.id, account.name);
      const place = (item: string) => {
        const n = resourceNodes.find((n) => n.item === item)!;
        p.x = n.x;
        p.z = n.z - 3;
        p.y = terrainHeight(w, p.x, p.z);
        p.heading = 0;
        return n;
      };
      place('logs');
      p.inventory = {};
      p.skills = [];
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
      await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
      const gather = page.locator('#resource-gather');
      const status = page.locator('#resource-status');
      await expect(gather).toBeVisible();
      await expect(gather).toBeDisabled();
      await expect(status).toContainText('Carry tools');
      p.inventory.tools = 1;
      for (const item of ['logs', 'stone', 'gravel', 'dirt']) {
        const n = place(item);
        if (item === 'dirt') p.inventory.tools = 0;
        // CI's software renderer may take several seconds to present a teleported
        // server snapshot. Keep the exact node assertion, with a bounded delivery wait.
        await expect(gather).toHaveAttribute('data-id', n.id, { timeout: 15000 });
        await expect(gather).toBeEnabled();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        const rect = (await gather.boundingBox())!;
        expect(rect.height).toBeGreaterThanOrEqual(48);
        expect(
          await page.locator('#resource-control').evaluate((e) => !!e.closest('.chat-panel')),
        ).toBe(false);
        if (item === 'logs')
          await page.screenshot({
            path: `test-results/gather-hud-${mobile ? 'phone' : 'desktop'}.png`,
          });
        if (mobile) await gather.tap();
        else await gather.click();
        await expect.poll(() => p.task?.resource).toBe(n.id);
        // Hold the fixture open through screenshots on software rendering; the
        // real duration is checked in simulation tests and completion below.
        p.task!.end = w.time + 300;
        await expect(page.locator('#resource-control')).toBeHidden();
        await expect(page.locator('#task-control')).toBeVisible();
        await expect(page.locator('#task-name')).toContainText('Gathering 3');
        await expect(page.locator('#task-countdown')).toHaveText(/^[0-9]+$/);
        expect(
          await page
            .locator('#task-countdown')
            .evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
        ).toBeGreaterThanOrEqual(42);
        expect(
          await page.locator('#task-control').evaluate((e) => !!e.closest('.chat-panel')),
        ).toBe(false);
        if (item === 'logs')
          await page.screenshot({
            path: `test-results/task-countdown-${mobile ? 'phone' : 'desktop'}.png`,
          });
        // Finish the server-owned task promptly; the duration is covered by unit tests.
        p.task!.end = w.time + 0.25;
        await expect.poll(() => p.inventory[item]).toBe(3);
        await expect(gather).toBeEnabled();
        await expect(page.locator('#task-control')).toBeHidden();
      }
      p.skills = ['excavator'];
      await expect(gather).toContainText('Gather 6');
      await expect(status).toContainText('12 seconds');
      const n = resourceNodes.find((n) => n.item === 'dirt')!;
      w.resources![n.id] = { amount: 0, updated: w.time };
      await expect(status).toContainText('replenish');
      await expect(gather).toBeDisabled();
      w.resources![n.id] = { amount: 30, updated: w.time };
      p.inventory.logs = 999;
      await expect(status).toContainText('cargo');
      await expect(gather).toBeDisabled();
      p.x = 0;
      p.z = 0;
      await expect(page.locator('#resource-control')).toBeHidden();
      const office = w.buildings.find((b) => b.kind === 'workhouse')!;
      p.x = office.x;
      p.z = office.z;
      p.y = terrainHeight(w, p.x, p.z);
      const prior = p.cash;
      act(w, p.id, { type: 'task', building: office.id, task: 'labour' });
      p.task!.end = w.time + 300;
      await expect(page.locator('#task-control')).toBeVisible();
      await expect(page.locator('#task-name')).toHaveText('Working a labour shift');
      await expect(page.locator('#target .task')).toHaveCount(0);
      const box = (await page.locator('#task-control').boundingBox())!;
      const size = page.viewportSize()!;
      expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThan(2);
      expect(Math.abs(box.y + box.height / 2 - size.height / 2)).toBeLessThan(2);
      p.task!.end = w.time + 0.25;
      await expect.poll(() => p.cash).toBe(prior + 4500);
      await expect(page.locator('#task-control')).toBeHidden();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
