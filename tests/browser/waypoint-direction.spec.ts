// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';

test('map waypoint follows camera look rather than stationary tractor heading', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-waypoint-view-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Waypoint tester');
    const w = createWorld('waypoint-view', 'Waypoint View', account.id);
    w.script = '';
    const school = w.buildings.find((b) => b.kind === 'school')!;
    w.buildings = [school];
    const p = addPlayer(w, account.id, account.name);
    p.x = school.x - 30;
    p.z = school.z - 70;
    p.heading = 0;
    p.engine = false;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('m');
    await page.getByRole('dialog').getByRole('button', { name: school.name, exact: true }).click();
    await page.keyboard.press('Escape');
    const arrow = page.locator('#waypoint-arrow');
    const degrees = () =>
      arrow.evaluate((el) =>
        Number((el as HTMLElement).style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1]),
      );
    await expect(page.locator('#waypoint-hud')).toBeVisible();
    await expect.poll(degrees).toBeLessThan(-10);
    await page.screenshot({ path: '/tmp/aclone-waypoint-left.png' });
    // Turn the view by about 180 degrees without moving/steering the tractor.
    await page.mouse.move(450, 450);
    await page.mouse.down();
    await page.mouse.move(900, 450, { steps: 12 });
    await page.mouse.up();
    await expect.poll(degrees).toBeGreaterThan(90);
    expect(p.heading).toBe(0);
    await page.keyboard.press('c'); // first-person with the same look direction
    await expect.poll(degrees).toBeGreaterThan(90);
    await page.keyboard.press('c'); // overhead, looking toward -z
    await expect.poll(degrees).toBeGreaterThan(90);
    await page.locator('#waypoint-clear').click();
    await expect(page.locator('#waypoint-hud')).toBeHidden();
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
