// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { resourceNodes } from '../../src/shared/resources.ts';

test('the parish map opens with M or a click and keeps navigation through live updates', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-map-test-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Map tester');
    const w = createWorld('map-test', 'Little Puddlewick', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
    await expect(map).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Parish directory.' })).toHaveCount(0);
    for (const b of w.buildings)
      await expect(map.getByRole('button', { name: b.name, exact: true })).toBeVisible();
    const resourceLabels = map.locator('.parish-map-resource-label');
    await expect(resourceLabels).toHaveCount(resourceNodes.length);
    // Every label points to a real ground, never the empty centre of a type's
    // widely separated sites. Coordinates also match the gathering action.
    for (const n of resourceNodes) {
      const kind = n.item === 'logs' ? 'Wood / logs' : n.item === 'dirt' ? 'Dirt' : n.item;
      await expect(
        resourceLabels.and(
          map.getByTitle(`${n.name} · ${kind} · (${n.x}, ${n.z})`, { exact: true }),
        ),
      ).toBeVisible();
    }
    await expect(
      map.locator('[data-player-id]').filter({ has: page.locator('title', { hasText: 'You' }) }),
    ).toHaveCount(1);
    // Default labels are fully legible rather than ellipsized into ambiguous names.
    expect(
      await map
        .locator('.parish-map-building-label, .parish-map-resource-label')
        .evaluateAll((nodes) => nodes.every((el) => el.scrollWidth <= el.clientWidth)),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/parish-map.png' });
    const zoom = map.getByRole('button', { name: 'Zoom in', exact: true });
    await zoom.focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(450);
    await page.keyboard.up('Space');
    await expect(map.locator('.parish-map-zoom')).toHaveText('150%');
    await expect(zoom).toBeFocused();
    await expect
      .poll(() => map.locator('.parish-map-viewport').evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(0);
    const remote = addPlayer(w, 'visitor', 'Map visitor');
    remote.online = true;
    remote.x = 90;
    await expect(map.locator('[data-player-id="visitor"]')).toHaveCount(1);
    const marker = map.locator('[data-player-id="visitor"]');
    const oldTransform = await marker.getAttribute('transform');
    remote.x = 120;
    await expect(marker).not.toHaveAttribute('transform', oldTransform!);
    remote.online = false;
    await expect(marker).toHaveCount(0);
    const added = makeBuilding('custom-map-home', 'home', -240, -175);
    added.name = '<img src=x onerror=alert(1)> & Cottage';
    w.buildings.push(added);
    await expect(map.getByRole('button', { name: added.name, exact: true })).toHaveCount(1);
    await expect(map.locator('img')).toHaveCount(0);
    await expect(zoom).toBeFocused();
    await map.getByRole('button', { name: 'Fit parish', exact: true }).click();
    await expect(map.locator('.parish-map-zoom')).toHaveText('100%');
    await map.getByRole('button', { name: 'Find me', exact: true }).click();
    const building = w.buildings.find((b) => b.kind === 'market')!;
    await map.getByRole('button', { name: building.name, exact: true }).click({ delay: 450 });
    await expect(page.getByRole('dialog', { name: building.name, exact: true })).toBeVisible();
    await page.keyboard.press('m');
    await expect(map).toBeVisible();
    await page.keyboard.press('m');
    await expect(map).toHaveCount(0);
    await page.locator('#chat-input').fill('m');
    await page.keyboard.press('m');
    await expect(map).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open parish map', exact: true }).click();
    await expect(map).toBeVisible();
    await map.getByRole('button', { name: 'Parish directory', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Parish directory.' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole('navigation', { name: 'Mobile game navigation' })
      .getByRole('button', { name: 'Map', exact: true })
      .click();
    await expect(map).toBeVisible();
    const viewport = map.locator('.parish-map-viewport');
    await expect.poll(() => viewport.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await viewport.focus();
    const left = await viewport.evaluate((el) => el.scrollLeft);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(left);
    await page.screenshot({ path: 'test-results/parish-map-mobile.png' });
    await page.keyboard.press('Escape');
    await expect(map).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
