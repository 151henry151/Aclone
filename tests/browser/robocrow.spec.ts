// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, act, terrainHeight } from '../../src/shared/simulation.ts';
import { weatherAt } from '../../src/shared/environment.ts';

test('industrial robocrow renders in flight and deploys, climbs and returns normally', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-robocrow-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Scout pilot');
    const w = createWorld('robocrow-preview', 'Puddlewick', account.id);
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const day = Array.from({ length: 70 }, (_, i) => 60 + i).find(
      (d) => weatherAt(w.id, d).precipitation === 'clear',
    )!;
    w.time = (day - 59 - 42200 / 86400) * 600;
    const p = addPlayer(w, account.id, account.name);
    p.x = -35;
    p.z = -170;
    p.y = terrainHeight(w, p.x, p.z);
    p.heading = Math.PI;
    p.inventory.rc = 2;
    const other = addPlayer(w, 'field-scout', 'Field scout');
    other.x = p.x;
    other.z = p.z - 8;
    other.y = p.y;
    other.heading = -0.45;
    act(w, other.id, { type: 'crow' });
    other.online = true;
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
    await page.keyboard.press('r');
    await expect.poll(() => p.vehicle).toBe(7);
    expect(p.inventory.rc).toBe(1);
    await page.keyboard.press('c');
    await page.keyboard.press('h');
    await page.mouse.move(700, 380);
    await page.mouse.down();
    await page.mouse.move(700, 463, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(2000);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'test-results/industrial-robocrow.png' });
    const altitude = p.y;
    await page.keyboard.down('Insert');
    await expect.poll(() => p.y).toBeGreaterThan(altitude + 2);
    await page.keyboard.up('Insert');
    const z = p.z;
    await page.keyboard.down('w');
    await expect.poll(() => p.z).toBeLessThan(z - 1);
    await page.keyboard.up('w');
    // Let the server receive neutral input before returning to the parked tractor.
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.1);
    await page.keyboard.press('r');
    await expect.poll(() => p.vehicle).toBe(0);
    expect(p.crowBody).toBeUndefined();
    expect(p.x).toBe(-35);
    expect(p.z).toBe(-170);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
