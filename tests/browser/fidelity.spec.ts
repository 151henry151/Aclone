// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { defaultCreator } from '../../src/shared/creator.ts';
import { waitForWorld } from './fixtures/ready';
test('controller menus, buying, building rotation, courses and maintenance use real UI actions', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-fidelity-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext(),
    page = await context.newPage();
  try {
    const { account, token } = app.universe.register('Fidelity pilot'),
      w = createWorld('fidelity-ui', 'Fidelity', account.id),
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    w.settings.mapSize = 500;
    w.creator = defaultCreator();
    w.creator.scenery = false;
    w.creator.roads = false;
    p.cash = 10000000;
    const shop = w.buildings.find((b) => b.kind === 'market')!;
    p.x = shop.x;
    p.z = shop.z - 12;
    shop.stock.water = 100;
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        (window as any).testPad = {
          connected: true,
          axes: [0, 0],
          buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
        };
        Object.defineProperty(navigator, 'getGamepads', { value: () => [(window as any).testPad] });
      },
      { token, world: w.id },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const port = await app.listen();
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const pulse = async (index: number) => {
      await page.evaluate((i) => {
        (window as any).testPad.buttons[i].pressed = true;
      }, index);
      await page.waitForTimeout(120);
      await page.evaluate((i) => {
        (window as any).testPad.buttons[i].pressed = false;
      }, index);
      await page.waitForTimeout(120);
    };
    await pulse(0);
    await expect(page.getByRole('dialog')).toContainText(shop.name);
    // Use the pad's actual focus traversal, not DOM clicks, for the first Buy button.
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Buy')) break;
      await pulse(13);
    }
    const before = { ...p.inventory };
    await pulse(0);
    await expect.poll(() => JSON.stringify(p.inventory)).not.toBe(JSON.stringify(before));
    await pulse(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByLabel('Architectural model', { exact: true }).focus();
    const prior = await page.getByLabel('Architectural model', { exact: true }).inputValue();
    await pulse(15);
    await expect(page.getByLabel('Architectural model', { exact: true })).not.toHaveValue(prior);
    await page.locator('[data-design="rotation"]').focus();
    const rotation = await page.locator('[data-design="rotation"]').inputValue();
    await pulse(15);
    await expect(page.locator('[data-design="rotation"]')).not.toHaveValue(rotation);
    await pulse(1);
    await page.getByRole('button', { name: 'First steps & leaving safely', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Carry provisions');
    await page.getByRole('button', { name: 'Pause for maintenance', exact: true }).click();
    await expect.poll(() => w.maintenance?.paused).toBe(true);
    await expect(page.getByRole('button', { name: 'Resume world', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Resume world', exact: true }).click();
    await expect.poll(() => w.maintenance?.paused).toBe(false);
    await pulse(1);
    await page.getByRole('button', { name: /Editor/ }).click();
    await page.getByRole('button', { name: 'Courses', exact: true }).click();
    await page.getByRole('button', { name: 'Save course', exact: true }).click();
    await expect.poll(() => w.courses?.length).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
