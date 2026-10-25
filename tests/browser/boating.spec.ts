// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer } from '../../src/shared/simulation';
import { boatLandings } from '../../src/shared/boathouse';
import { travelHeight } from '../../src/shared/dock';
import { FISHING_BOAT } from '../../src/shared/boats';
import { waitForWorld } from './fixtures/ready';
test('boatyard purchase desk, persistent throttle, trawl controls and fuel rescue work in the game', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-boating-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen(),
      w = app.worlds.get('puddlewick')!;
    const { account, token } = app.universe.register('Boatyard test skipper');
    const p = addPlayer(w, account.id, account.name),
      d = boatLandings(w).find((d) => d.building)!;
    w.settings.vehicleLicences = false;
    Object.assign(p, d.land, {
      y: travelHeight(w, d.land.x, d.land.z),
      heading: Math.PI,
      fleet: [0, 5, 3, FISHING_BOAT],
      inventory: {},
      fuelVehicle: 0,
      fuel: 40,
      parkedFuel: { 3: 64, 30: 144 },
      engine: false,
    });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('e');
    await expect(page.getByText('Commercial fishing', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/boatyard-menu.png' });
    await page.locator('[data-do="vehicle"][data-id="30"]').click();
    await expect.poll(() => p.vehicle).toBe(FISHING_BOAT);
    expect(p.fuel).toBe(144);
    await page.keyboard.press('Escape');
    // Move the fixture to open water; actual browser keys and the real server
    // then exercise the throttle and towing. The unit test runs the full tow.
    Object.assign(p, { x: 0, z: 400, y: w.settings.seaLevel, heading: 0, speed: 0 });
    await expect(page.locator('#trawl-status')).toContainText('deep water');
    await page.keyboard.press('F4');
    await expect.poll(() => p.engine).toBe(true);
    await page.keyboard.down('w');
    await expect.poll(() => p.boatThrottle ?? 0).toBeGreaterThan(0.4);
    await page.keyboard.up('w');
    await page.waitForTimeout(500);
    const throttle = p.boatThrottle!;
    await page.waitForTimeout(700);
    expect(p.boatThrottle).toBeCloseTo(throttle, 5);
    expect(p.speed).toBeGreaterThan(1);
    await page.locator('#trawl-controls [data-id="deploy"]').click();
    await expect.poll(() => p.trawl?.deployed).toBe(true);
    await expect.poll(() => p.trawl?.seconds ?? 0).toBeGreaterThan(0.1);
    await page.screenshot({ path: 'test-results/fishing-boat-trawling.png' });
    p.trawl!.seconds = 719.8;
    await expect(page.locator('#trawl-status')).toContainText('Catch ready');
    await page.locator('#trawl-controls [data-id="haul"]').click();
    await expect.poll(() => p.inventory.cod ?? 0).toBeGreaterThan(0);
    await page.keyboard.press('b');
    await expect.poll(() => p.boatThrottle).toBe(0);
    Object.assign(p, { fuel: 0, speed: 0 });
    await page.keyboard.press('i');
    await page.locator('[data-do="lifeboat"][data-id="launch"]').click();
    await expect.poll(() => p.vehicle).toBe(29);
    expect(w.boatRescues![p.id].boat.slot).toBe(30);
    await page.keyboard.press('Escape');
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/lifeboat-alongside.png' });
    await page.keyboard.press('Escape');
    const from = { x: p.x, z: p.z };
    await page.keyboard.down('w');
    await expect.poll(() => Math.hypot(p.x - from.x, p.z - from.z)).toBeGreaterThan(2);
    await page.keyboard.up('w');
    Object.assign(p, d.berth, { speed: 0 });
    await expect(page.locator('#target')).toContainText('Puddlewick boatyard');
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => p.vehicle).toBe(5);
    expect(w.boatRescues![p.id].dinghy.moored).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
