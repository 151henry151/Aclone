// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('HUD panels toggle independently, persist, and fit small laptop screens without overlap', async ({
  page,
}) => {
  test.setTimeout(300000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-hud-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('HUD keeper'),
      w = createWorld('hud', 'Puddlewick', account.id);
    w.settings.mapSize = 500;
    w.settings.activeWork = false;
    w.script = '';
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    const p = addPlayer(w, account.id, account.name),
      b = makeBuilding('light', 'lighthouse', 80, 80);
    b.name = 'Puddlewick harbour light';
    w.buildings = [b];
    p.job = b.id;
    p.activeUntil = w.time + 1000;
    p.inventory = { bread: 43, water: 26 };
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'hud');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto('http://127.0.0.1:' + port);
    await waitForWorld(page);
    await expect(page.locator('.pilot-summary #work-shift')).toContainText('Employed');
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1024, 600],
    ]) {
      await page.setViewportSize({ width, height });
      await expect(page.locator('#hud-controls')).toBeVisible();
      const boxes = await page.evaluate(() =>
        [
          '.left-panel',
          '.status-panel',
          '.chat-panel',
          '.inventory-panel',
          '.bottom-left',
          '.quickbar',
          '.location',
          '#hud-controls',
        ].map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
      for (const b of boxes) {
        expect(b.x, b.selector).toBeGreaterThanOrEqual(0);
        expect(b.y, b.selector).toBeGreaterThanOrEqual(0);
        expect(b.right, b.selector).toBeLessThanOrEqual(width + 1);
        expect(b.bottom, b.selector).toBeLessThanOrEqual(height + 1);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          expect(
            Math.min(a.right, b.right) <= Math.max(a.x, b.x) ||
              Math.min(a.bottom, b.bottom) <= Math.max(a.y, b.y),
            a.selector + ' overlaps ' + b.selector,
          ).toBe(true);
        }
      await page.screenshot({ path: 'test-results/hud-' + width + '.png' });
    }
    await page.getByRole('button', { name: 'Hide chat', exact: true }).click();
    await expect(page.locator('#chat-log')).toBeHidden();
    await expect(page.locator('.minimap-panel')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#chat-input')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.locator('#hud-controls').click();
    await page.locator('[data-hud-panel="map"]').uncheck();
    await page.locator('[data-hud-panel="status"]').uncheck();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('.left-panel')).toBeHidden();
    await expect(page.locator('.status-panel')).toBeHidden();
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('.left-panel')).toBeHidden();
    await expect(page.locator('.status-panel')).toBeHidden();
    await page.locator('#hud-controls').click();
    await page.getByRole('button', { name: 'Essential panels', exact: true }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('.minimap-panel')).toBeVisible();
    await expect(page.locator('.pilot-summary')).toBeVisible();
    await page.keyboard.press('h');
    await expect(page.locator('#world-hud')).toBeHidden();
    await page.keyboard.press('h');
    await expect(page.locator('#hud-controls')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
