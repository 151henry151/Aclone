// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { weatherAt } from '../../src/shared/environment.ts';

test('spaceport apron renders by day and night and its terminal remains accessible', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-spaceport-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Spaceport visitor');
    const w = createWorld('spaceport-preview', 'Puddlewick', account.id);
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const day = Array.from({ length: 70 }, (_, i) => 60 + i).find(
      (d) => weatherAt(w.id, d).precipitation === 'clear',
    )!;
    w.time = (day - 59 - 42200 / 86400) * 600;
    const portBuilding = w.buildings.find((b) => b.kind === 'starport')!;
    const p = addPlayer(w, account.id, account.name);
    p.x = portBuilding.x + 60;
    p.z = portBuilding.z + 230;
    p.heading = Math.PI;
    p.vehicle = 5;
    const parked = addPlayer(w, 'apron-inspector', 'Apron inspector');
    parked.x = portBuilding.x + 140;
    parked.z = portBuilding.z + 65;
    parked.heading = 0.5;
    parked.online = true;
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
    await page.keyboard.press('h');
    await page.keyboard.press('c');
    await page.mouse.move(700, 380);
    await page.mouse.down();
    await page.mouse.move(674, 280, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(3000);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'test-results/industrial-spaceport-day.png' });
    w.settings.time = 0;
    await page.waitForTimeout(1600);
    await page.screenshot({ path: 'test-results/industrial-spaceport-night.png' });
    w.settings.time = 43200;
    await page.keyboard.press('h');
    p.x = portBuilding.x;
    p.z = portBuilding.z + 12;
    await expect(page.locator('#target')).toContainText(portBuilding.name);
    await page.keyboard.press('e');
    await expect(
      page.getByRole('button', { name: 'Take off to space', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Take off to space', exact: true }).click();
    await expect(page.locator('.galaxy-view')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
