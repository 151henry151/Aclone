// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
import { landscapeSchema } from '../../src/shared/landscape.ts';
import { waitForWorld } from './fixtures/ready';
test('two-handed flight reaches the server, latches throttle, banks the aircraft and reports a crash', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-flight-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen();
    const { account, token } = app.universe.register('Test aviator');
    const w = app.worlds.get('puddlewick')!;
    w.buildings = [];
    w.terrain = [];
    w.settings.mapSize = 3000;
    w.settings.vehicleLicences = false;
    w.creator = creatorSchema.parse({ scenery: false });
    w.landscape = landscapeSchema.parse({ heightmap: Array(1089).fill(10) });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 2,
      fleet: [0, 5, 2],
      x: 0,
      z: -300,
      y: 10,
      fuel: 50,
      engine: true,
      heading: 0,
    });
    app.store.saveWorld(w);
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await expect(page.locator('#flight-readout')).toContainText('GROUND');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of [
      'Increase throttle',
      'Decrease throttle; hold at idle to push back',
      'Pitch nose up',
      'Pitch nose down',
      'Bank left',
      'Bank right',
      'Wheel brakes',
    ])
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    for (const key of ['forward', 'reverse']) {
      const fits = await page
        .locator(`[data-hold="${key}"]`)
        .evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(fits, 'Throttle labels fit their touch buttons').toBe(true);
    }
    await expect(page.locator('#flight-readout')).toBeVisible();
    await page.screenshot({ path: 'test-results/biplane-flight-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    const parkedZ = p.z;
    await page.keyboard.down('s');
    await expect.poll(() => p.z).toBeLessThan(parkedZ - 2);
    await expect(page.locator('#flight-readout')).toContainText('PUSHBACK');
    expect(p.flight!.grounded).toBe(true);
    expect(p.flight!.throttle).toBe(0);
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.01);
    await page.keyboard.up('s');
    await page.keyboard.up('b');
    await page.keyboard.down('w');
    await expect.poll(() => p.flight?.throttle, { timeout: 30000 }).toBeGreaterThan(0.98);
    await page.keyboard.up('w');
    await page.waitForTimeout(1000);
    expect(p.flight!.throttle).toBeGreaterThan(0.98);
    expect(p.flight!.grounded).toBe(true);
    // Rotate at flying speed, not after a fixed wall-clock delay. Software WebGL
    // and shared CI runners can advance the simulation more slowly than real time.
    await expect.poll(() => p.flight?.airspeed, { timeout: 45000 }).toBeGreaterThan(20);
    await page.keyboard.down('ArrowDown');
    await expect.poll(() => p.flight?.grounded, { timeout: 30000 }).toBe(false);
    await page.keyboard.up('ArrowDown');
    await expect.poll(() => p.y).toBeGreaterThan(12);
    await page.keyboard.down('ArrowLeft');
    await expect.poll(() => p.flight?.bank).toBeGreaterThan(0.25);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('c');
    await expect(page.locator('#flight-readout')).toHaveCount(1);
    await page.screenshot({ path: 'test-results/biplane-flight-cockpit.png' });
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/biplane-flight-scenery.png' });
    await page.keyboard.press('Escape');
    // Let the authoritative collision path handle a low, fast descent. No client-only crash.
    p.y = 10.05;
    Object.assign(p.flight!, { vy: -10, bank: 0, pitch: 0.05 });
    await expect.poll(() => p.vehicle).toBe(5);
    await expect(page.locator('#chat-log')).toContainText('destroyed');
    expect(p.fleet).toEqual([0, 5]);
    await expect(page.locator('#flight-readout')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
