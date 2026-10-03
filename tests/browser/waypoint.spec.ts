// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
test('map waypoints persist and guide desktop and touch driving without marking drags', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-waypoint-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Navigator');
    const w = app.worlds.get('puddlewick')!,
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    p.x = 0;
    p.z = 0;
    p.heading = 0;
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('m');
    const map = page.locator('#parish-map');
    await map.getByRole('button', { name: 'Choose waypoint', exact: true }).click();
    const b = w.buildings.find((b) => b.kind === 'market')!;
    await map.getByRole('button', { name: b.name, exact: true }).click();
    await expect(map.locator('[data-waypoint-marker]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#waypoint-name')).toHaveText(b.name);
    const arrow = page.locator('#waypoint-arrow'),
      initial = await arrow.getAttribute('style');
    p.heading = Math.PI / 2;
    await expect(arrow).not.toHaveAttribute('style', initial!);
    p.x = b.x;
    p.z = b.z;
    await expect(page.locator('#waypoint-distance')).toContainText('Arrived');
    await page.reload();
    await expect(page.locator('#waypoint-name')).toHaveText(b.name);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('navigation', { name: 'Mobile game navigation' })
      .getByRole('button', { name: 'Map', exact: true })
      .tap();
    await map.getByRole('button', { name: 'Clear waypoint', exact: true }).tap();
    const viewport = map.locator('.parish-map-viewport');
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + 80, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 120, { steps: 5 });
    await page.mouse.up();
    await expect(map.locator('[data-waypoint-marker]')).toHaveCount(0);
    // Tap empty ground with a touch pointer; coordinate conversion includes pan/zoom.
    await map.getByRole('button', { name: 'Zoom in', exact: true }).tap();
    await map.getByRole('button', { name: 'Mark centre', exact: true }).tap();
    await expect(map.locator('[data-waypoint-marker]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#waypoint-hud')).toBeVisible();
    await page.screenshot({ path: 'test-results/waypoint-phone.png' });
    await page.getByRole('button', { name: 'Clear waypoint', exact: true }).tap();
    await expect(page.locator('#waypoint-hud')).toBeHidden();
    await page.reload();
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#waypoint-hud')).toBeHidden();
  } finally {
    await context.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
