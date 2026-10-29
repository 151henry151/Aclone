// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../../src/server/puddlewick-boatyard';
import { boatLandings } from '../../src/shared/boathouse';
import { travelHeight } from '../../src/shared/dock';
import { waitForWorld } from './fixtures/ready';
test('passenger accepts a charter, fishes from the boat in scenery view and receives an early-return refund', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-charter-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }),
    page = await context.newPage();
  try {
    const { account, token } = app.universe.register('Charter guest');
    const w = createWorld('puddlewick', 'Puddlewick', 'server');
    w.script = '';
    w.settings.vehicleLicences = false;
    w.settings.hungerRate = 0;
    w.settings.thirstRate = 0;
    ensurePuddlewickBoatyard(w);
    const d = boatLandings(w).find((d) => d.building)!;
    const c = addPlayer(w, 'captain', 'Captain Belle'),
      p = addPlayer(w, account.id, account.name);
    for (const q of [c, p])
      Object.assign(q, d.land, {
        y: travelHeight(w, d.land.x, d.land.z),
        cash: 3000000,
        online: true,
        inventory: { tackle: 1 },
        fleet: [0, 5],
      });
    act(w, c.id, { type: 'vehicle', slot: 31, building: d.id });
    act(w, c.id, { type: 'charter', operation: 'offer', player: p.id, fare: 7500, minutes: 60 });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await expect(page.getByRole('button', { name: 'Accept & board' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept & board' }).click();
    await expect.poll(() => p.hitch).toBe(c.id);
    await expect(page.getByRole('heading', { name: 'Your charter' })).toBeVisible();
    await page.keyboard.press('Escape');
    Object.assign(c, { x: 0, z: 1400, y: 0, speed: 0 });
    await expect.poll(() => p.z).toBe(1400);
    await expect(page.locator('#fishing-cast')).toBeVisible();
    await page.locator('#fishing-cast').click();
    await expect.poll(() => p.game).toBe('fishing');
    await page.keyboard.press('h');
    const reel = page.locator('#scenery-fishing-action');
    await expect(reel).toHaveText('Waiting · Stop fishing');
    p.fishAt = w.time;
    p.fishUntil = w.time + 60;
    p.fishCatch = 'halibut';
    await expect(reel).toHaveText('Fish! Reel in · F3');
    await reel.click();
    await expect.poll(() => p.inventory.halibut).toBe(1);
    await page.screenshot({ path: 'test-results/charter-passenger-fishing.png' });
    await reel.click();
    await expect.poll(() => p.game).toBeUndefined();
    await page.keyboard.press('Escape');
    c.charter!.elapsed = 1800;
    Object.assign(c, d.berth, { speed: 0 });
    await expect.poll(() => p.z).toBe(d.berth.z);
    await page.keyboard.press('i');
    await expect(page.getByRole('button', { name: 'Settle fare & step ashore' })).toBeVisible();
    await page.getByRole('button', { name: 'Settle fare & step ashore' }).click();
    await expect.poll(() => p.hitch).toBeUndefined();
    expect(p.cash).toBe(2996250);
    expect(p.inventory.halibut).toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
