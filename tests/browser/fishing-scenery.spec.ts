// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { waitForWorld } from './fixtures/ready';

test('canal-boat scenery view retains one compact, working fishing action through bite cycles', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-scenery-fishing-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    const { account, token } = app.universe.register('Canal angler');
    const w = createWorld('scenery-fishing', 'Scenery fishing', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: 1400,
      vehicle: 3,
      fleet: [0, 3, 5],
      inventory: { tackle: 1 },
      fuel: 50,
    });
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.locator('#fishing-cast').click();
    await expect.poll(() => p.game).toBe('fishing');
    expect(p.fishAt! - w.time).toBeGreaterThan(0);
    expect(Number.isFinite(p.fishAt)).toBe(true);
    await page.keyboard.press('h');
    const action = page.locator('#scenery-fishing-action');
    await expect(action).toBeVisible();
    await expect(action).toHaveText('Waiting · Stop fishing');
    await expect(action).toBeEnabled();
    await expect(page.locator('.chat-panel')).toBeHidden();
    await expect(page.locator('#fishing-reel')).toBeHidden();
    const box = (await page.locator('#fishing-control').boundingBox())!;
    expect(box.y).toBeGreaterThan(750);
    expect(box.height).toBeLessThan(70);
    expect(box.width).toBeLessThan(300);
    p.fishCatch = 'halibut';
    p.fishAt = w.time;
    p.fishUntil = w.time + 30;
    await expect(action).toHaveText('Fish! Reel in · F3');
    await expect(action).toHaveCSS('background-color', 'rgb(237, 207, 126)');
    await page.screenshot({ path: 'test-results/canal-fishing-scenery.png' });
    await action.click();
    await expect.poll(() => p.inventory.halibut).toBe(1);
    await expect(action).toHaveText('Waiting · Stop fishing');
    await expect(action).toBeEnabled();
    expect(p.game).toBe('fishing');
    // A missed bite schedules another catch and does not silently grant fish.
    p.fishAt = w.time - 10;
    p.fishUntil = w.time - 1;
    await expect.poll(() => p.fishAt! > w.time).toBe(true);
    expect(p.inventory.halibut).toBe(1);
    p.fishCatch = 'cod';
    p.fishAt = w.time;
    p.fishUntil = w.time + 30;
    await expect(action).toHaveText('Fish! Reel in · F3');
    await page.keyboard.press('F3');
    await expect.poll(() => p.inventory.cod).toBe(1);
    await page.keyboard.press('h');
    await expect(action).toBeHidden();
    await expect(page.locator('#fishing-stop')).toBeVisible();
    await page.keyboard.press('h');
    await expect(action).toHaveText('Waiting · Stop fishing');
    await expect(action).toBeEnabled();
    await action.click();
    await expect.poll(() => p.game).toBeUndefined();
    await expect(action).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#fishing-cast')).toBeVisible();
    act(w, p.id, { type: 'boatLights', circuit: 'cabin' });
    await page.getByRole('button', { name: 'Lights', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cabin light: warm white' })).toBeVisible();
    await page.getByRole('button', { name: 'Deck floodlights: off' }).click();
    await expect.poll(() => p.boatLighting?.deck).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
