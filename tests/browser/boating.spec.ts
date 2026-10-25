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
  // This scenario also renders expanded/collapsed HUDs at four viewport sizes.
  test.setTimeout(360000);
  await page.setViewportSize({ width: 1440, height: 900 });
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
    // Reproduce the live report: the building menu opens here, well beyond
    // the old five-metre boarding area around the shore entrance.
    const approach = { x: -32.27455230580994, z: 141.17068005055614 };
    Object.assign(p, approach, {
      y: travelHeight(w, approach.x, approach.z),
      heading: Math.PI,
      fleet: [0, 5, FISHING_BOAT],
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
    await expect(page.getByRole('button', { name: /Buy and board Canal boat/ })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Board your Fishing boat', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/boatyard-menu.png' });
    await page.locator('[data-do="vehicle"][data-id="30"]').click();
    await expect.poll(() => p.vehicle).toBe(FISHING_BOAT);
    expect(p.fuel).toBe(144);
    await page.keyboard.press('Escape');
    await expect(page.locator('#trawl-controls')).toBeHidden();
    await expect(page.locator('#trawl-toggle')).toHaveAttribute('aria-expanded', 'false');
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
      { width: 760, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      for (const expanded of [false, true]) {
        if (expanded) await page.locator('#trawl-toggle').click();
        await expect(async () => {
          const fishing = (await page.locator('#fishing-control').boundingBox())!;
          const driving = (await page.locator('#driving').boundingBox())!;
          expect(fishing.y + fishing.height).toBeLessThanOrEqual(driving.y - 8);
          expect(fishing.x).toBeGreaterThanOrEqual(0);
          expect(fishing.y).toBeGreaterThanOrEqual(0);
          expect(fishing.x + fishing.width).toBeLessThanOrEqual(viewport.width);
          expect(driving.y + driving.height).toBeLessThanOrEqual(viewport.height);
        }).toPass();
        await page.screenshot({
          path: `test-results/fishing-hud-${viewport.width}-${expanded ? 'expanded' : 'collapsed'}.png`,
        });
      }
      await page.locator('#trawl-toggle').click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#trawl-toggle').click();
    await expect(page.locator('#trawl-controls')).toBeVisible();
    await page.locator('#trawl-toggle').click();
    await expect(page.locator('#trawl-controls')).toBeHidden();
    await page.locator('.bottom-left [data-do="lights"]').click();
    await page.getByRole('button', { name: 'Deck floodlights: off', exact: true }).click();
    await expect.poll(() => p.boatLighting?.deck).toBe(true);
    await page.getByRole('button', { name: 'Cabin light: off', exact: true }).click();
    await expect.poll(() => p.boatLighting?.cabin).toBe('warm');
    await page.getByRole('button', { name: 'Cabin light: warm white', exact: true }).click();
    await expect.poll(() => p.boatLighting?.cabin).toBe('red');
    await page.keyboard.press('Escape');
    await page.locator('#trawl-toggle').click();
    await expect(page.locator('#trawl-controls')).toBeVisible();
    p.inventory = { bread: 10, water: 10 };
    await page.keyboard.press('i');
    await expect(
      page.locator('[data-do="expedition"][data-id="store"][data-item="bread"]'),
    ).toBeVisible();
    await page.locator('#boat-store-quantity').fill('5');
    await page.locator('[data-do="expedition"][data-id="store"][data-item="bread"]').click();
    await expect.poll(() => p.boatStores?.bread ?? 0).toBe(5);
    await page.screenshot({ path: 'test-results/fishing-provisions.png' });
    await page.keyboard.press('Escape');
    // Move the fixture to open water; actual browser keys and the real server
    // then exercise throttle and continuous catching; unit tests simulate long trips.
    Object.assign(p, { x: 0, z: 1400, y: w.settings.seaLevel, heading: 0, speed: 0 });
    await expect(page.locator('#trawl-status')).toContainText('Nets stowed');
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
    p.trawl!.shoal = { ground: 0, nextChange: 1000, nextFish: 0.1 };
    await expect.poll(() => p.trawl?.catch?.cod ?? 0).toBeGreaterThan(0);
    await expect(page.locator('#trawl-status')).not.toContainText('cod');
    await expect(page.locator('#trawl-status')).toContainText('Towing');
    await expect(page.locator('#trawl-status')).not.toContainText('remaining');
    expect(p.trawl!.seconds).toBeLessThan(60);
    await page.screenshot({ path: 'test-results/fishing-continuous-catch.png' });
    await page.locator('#trawl-controls [data-id="haul"]').click();
    await expect.poll(() => p.inventory.cod ?? 0).toBeGreaterThan(0);
    // Seed only the load for the visual/full-net state; hauling still uses the UI/server path.
    p.trawl!.catch = { cod: 160 };
    p.trawl!.netFull = true;
    p.trawl!.deployed = false;
    await expect(page.locator('#trawl-status')).toContainText('full');
    await page.screenshot({ path: 'test-results/fishing-full-net.png' });
    await page.locator('#trawl-controls [data-id="haul"]').click();
    await expect.poll(() => p.inventory.cod ?? 0).toBeGreaterThan(160);
    await page.waitForTimeout(2800);
    await page.screenshot({ path: 'test-results/fishing-hauling.png' });
    await page.keyboard.press('c');
    await expect(page.locator('#trawl-throttle')).toContainText('°');
    await page.screenshot({ path: 'test-results/fishing-helm-compass.png' });
    await page.keyboard.press('c');
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
    Object.assign(p, { x: d.berth.x, z: d.berth.z + 22, speed: 0 });
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
