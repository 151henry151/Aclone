// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { Store } from '../../src/server/store';
import { createWorld, addPlayer, terrainHeight } from '../../src/shared/simulation';
import { flightState } from '../../src/shared/flight';
import { waitForWorld } from './fixtures/ready';

test('hangar boarding, visible runway and a server-confirmed crash preserve spare aircraft', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-airfield-'));
  const store = new Store(join(dir, 'aclone.sqlite'));
  const seed = createWorld('puddlewick', 'Puddlewick', 'server');
  seed.towns[0].radius = 310;
  store.saveWorld(seed);
  store.close();
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /shader|WebGL/i.test(m.text())) errors.push(m.text());
  });
  try {
    const port = await app.listen(),
      w = app.worlds.get('puddlewick')!;
    const { account, token } = app.universe.register('Airfield test pilot');
    const p = addPlayer(w, account.id, account.name);
    const a = w.airfield!,
      hangar = w.buildings.find((b) => b.id === a.hangar)!;
    w.settings.vehicleLicences = false;
    Object.assign(p, {
      x: hangar.x - 15,
      z: hangar.z,
      y: a.height,
      heading: Math.PI / 2,
      fleet: [0, 5, 2],
      spareBiplanes: 3,
      parkedFuel: { 2: 64 },
      inventory: {},
      engine: false,
    });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/airfield-hangar-exterior.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(page.getByText('4 biplane airframes owned', { exact: false })).toBeVisible();
    await page.screenshot({ path: 'test-results/airfield-hangar-menu.png' });
    await page.locator('[data-do="vehicle"][data-id="2"]').click();
    await expect.poll(() => p.vehicle).toBe(2);
    expect(p.engine).toBe(false);
    expect(p.spareBiplanes).toBe(3);
    expect(p.fuel).toBe(64);
    await page.keyboard.press('Escape');
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/airfield-hangar.png' });
    await page.keyboard.press('Escape');
    // Position on the threshold in this disposable test world, then use actual
    // flight keys for the runway takeoff. No live player or live world is touched.
    Object.assign(p, { x: a.x, z: a.z - a.length / 2 + 10, y: a.height, heading: 0, speed: 0 });
    delete p.flight;
    await expect(page.locator('#flight-readout')).toContainText('GROUND');
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(1000);
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/airfield-runway.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('c');
    await page.keyboard.press('F4');
    await expect.poll(() => p.engine).toBe(true);
    // Accelerate with neutral elevator, then rotate at flying speed. Holding
    // full back-stick throughout the roll stalls the wing and lengthens takeoff.
    let firstAirborneZ: number | undefined;
    const watch = setInterval(() => {
      if (p.flight?.grounded === false && firstAirborneZ === undefined) firstAirborneZ = p.z;
    }, 10);
    watch.unref();
    await page.keyboard.down('w');
    await expect.poll(() => p.flight?.throttle).toBeGreaterThan(0.98);
    await page.keyboard.up('w');
    await expect
      .poll(() => p.flight?.airspeed, { timeout: 45000, intervals: [50] })
      .toBeGreaterThan(20);
    await page.keyboard.down('ArrowDown');
    await expect.poll(() => p.flight?.grounded, { intervals: [50] }).toBe(false);
    // Record touchdown/takeoff position before the next browser round trip;
    // software WebGL can delay key-up delivery while the server keeps flying.
    clearInterval(watch);
    const takeoffZ = firstAirborneZ ?? p.z;
    await page.keyboard.up('ArrowDown');
    expect(takeoffZ).toBeLessThan(a.z + a.length / 2);
    // Authoritative hard landing, with the normal client receiving its impact event.
    p.y = terrainHeight(w, p.x, p.z) + 0.02;
    Object.assign(flightState(p, a.height), { vy: -15, bank: 0, pitch: 0 });
    await expect.poll(() => p.vehicle).toBe(5);
    await page.screenshot({ path: 'test-results/airfield-crash-fire.png' });
    expect(p.spareBiplanes).toBe(3);
    expect(p.fleet).not.toContain(2);
    await expect(page.locator('#chat-log')).toContainText('destroyed');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
