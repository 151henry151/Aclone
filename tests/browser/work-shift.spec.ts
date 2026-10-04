// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, act } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';

for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} work countdown and renewal reflect saved shifts`, async ({
    browser,
  }) => {
    const context = await browser.newContext(
      mobile
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        : { viewport: { width: 960, height: 600 } },
    );
    const page = await context.newPage();
    const dir = mkdtempSync(join(tmpdir(), 'aclone-shift-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    try {
      const { account, token } = app.universe.register('Worker');
      const w = createWorld('shift', 'Shift test', 'owner');
      const b = w.buildings.find((b) => b.kind === 'mill')!;
      w.buildings = [b];
      w.zones = [];
      w.script = '';
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      const p = addPlayer(w, account.id, account.name);
      Object.assign(p, { x: b.x, z: b.z + 12, skills: ['miller'] });
      act(w, p.id, { type: 'job', building: b.id });
      app.worlds.set(w.id, w);
      const port = await app.listen();
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'shift');
          localStorage.setItem('aclone.quality', 'low');
        },
        { token },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
      await expect(page.locator('#work-shift')).toContainText('Shift active');
      await page.locator('#target button').click();
      const work = page.locator('[data-work-button]');
      await expect(work).toBeDisabled();
      await expect(page.locator('[data-work-status]')).toContainText('You may drive away');
      p.activeUntil = w.time + 30;
      await expect(work).toHaveText('Renew for two cycles');
      await expect(work).toBeEnabled();
      p.activeUntil = w.time - 1;
      await expect(page.locator('[data-work-status]')).toContainText('Shift ended');
      await expect(work).toHaveText('Work two cycles');
      await work.click();
      await expect.poll(() => p.activeUntil - w.time).toBeGreaterThan(1000);
      await expect(work).toBeDisabled();
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await expect(page.locator('#work-shift')).toContainText('Shift active');
      await page.screenshot({
        path: `test-results/work-shift-${mobile ? 'phone' : 'desktop'}.png`,
      });
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
