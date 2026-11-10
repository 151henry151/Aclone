// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} world ghost preserves design, cancels freely and confirms valid sites only`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-ghost-')),
      app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 430, height: 932 } : { width: 1440, height: 900 },
      ...(mobile ? { isMobile: true, hasTouch: true } : {}),
    });
    mkdirSync('output/construction-ghost', { recursive: true });
    try {
      const { account, token } = app.universe.register('GhostBuilder');
      const w = createWorld('ghost-test', 'Construction preview', account.id);
      Object.assign(w, { buildings: [], zones: [], script: '', tier: 10 });
      w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
      Object.assign(w.settings, { hungerRate: 0, thirstRate: 0, dayLength: 0, time: 43200 });
      const p = addPlayer(w, account.id, account.name);
      Object.assign(p, { x: 80, z: 0, vehicle: 5, cash: 100000000 });
      app.worlds.set(w.id, w);
      const port = await app.listen(),
        page = await context.newPage(),
        errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'ghost-test');
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(page);
      const open = async () => {
        if (mobile) await page.locator('.mobile-nav [data-do="mobile-actions"]').click();
        await page.locator('[data-do="construction"]:visible').click();
      };
      const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await open();
      await page.getByLabel('Building type', { exact: true }).selectOption('warehouse');
      await page.getByLabel('Architectural model', { exact: true }).selectOption('model-3');
      await page.getByLabel('Surface finish', { exact: true }).selectOption('metal-panel');
      await page.getByLabel('Building size', { exact: true }).selectOption('large');
      const cash = p.cash;
      await expect(page.getByRole('button', { name: 'Preview in world', exact: true })).toBeVisible(
        { timeout: 5000 },
      );
      await page.getByRole('button', { name: 'Preview in world', exact: true }).click();
      await expect(page.locator('[data-world-preview-status]')).toContainText('Site clear');
      p.cash = 0;
      await expect(
        page.getByRole('button', { name: 'Confirm foundation', exact: true }),
      ).toBeDisabled();
      await expect(page.locator('[data-world-preview-status]')).toContainText('Not enough cash');
      p.cash = cash;
      await expect(
        page.getByRole('button', { name: 'Confirm foundation', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'View from right', exact: true }).click();
      await page.getByRole('button', { name: 'Turn building right', exact: true }).click();
      await expect(page.locator('[data-world-preview-bearing]')).toContainText('15°');
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `output/construction-ghost/${mobile ? 'phone' : 'desktop'}.png`,
      });
      await page.getByRole('button', { name: 'Back to designer', exact: true }).click();
      await expect(page.getByLabel('Building size', { exact: true })).toHaveValue('large');
      await expect(page.getByLabel('Building rotation', { exact: true })).toHaveValue('15');
      await page.getByRole('button', { name: 'Preview in world', exact: true }).click();
      await close();
      expect(w.buildings).toHaveLength(0);
      expect(p.cash).toBe(cash);
      await expect(page.locator('.construction-world-preview')).toHaveCount(0);
      await open();
      await page.getByRole('button', { name: 'Preview in world', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm foundation', exact: true }).click();
      await expect.poll(() => w.buildings.length).toBe(1);
      const b = w.buildings[0];
      expect(b.x).toBeCloseTo(80);
      expect(b.z).toBeCloseTo(0);
      expect(b.size).toBe('large');
      expect(b.style).toBe('metal-panel');
      expect(b.architecture).toBe('model-3');
      expect(b.rotation).toBeCloseTo(Math.PI / 12);
      expect(p.cash).toBeLessThan(cash);
      await expect(page.locator('.construction-world-preview')).toHaveCount(0);
      await open();
      await page.getByRole('button', { name: 'Preview in world', exact: true }).click();
      await expect(page.locator('[data-world-preview-status]')).not.toContainText('Site clear');
      await expect(
        page.getByRole('button', { name: 'Confirm foundation', exact: true }),
      ).toBeDisabled();
      const after = p.cash;
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `output/construction-ghost/${mobile ? 'phone' : 'desktop'}-refused.png`,
      });
      await close();
      expect(p.cash).toBe(after);
      expect(w.buildings).toHaveLength(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
