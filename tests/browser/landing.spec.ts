// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { flightState } from '../../src/shared/flight';
import { ensurePuddlewickAirfield } from '../../src/server/puddlewick-airfield';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('keyboard arrival lands on the public strip; owner can select strict contacts and disable the airbrake', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-landing-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let lastInput: any;
  page.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === 'input') lastInput = message.input;
    }),
  );
  try {
    const { account, token } = app.universe.register('Landing pilot');
    const w = createWorld('puddlewick', 'Puddlewick', 'server');
    w.towns[0].radius = 310;
    expect(ensurePuddlewickAirfield(w)).toBe(true);
    const a = w.airfield!;
    w.owner = account.id;
    w.script = '';
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.buildings = w.buildings.filter((b) => b.id === a.hangar);
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.vehicleLicences = false;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 2,
      fleet: [0, 5, 2],
      fuel: 64,
      engine: false,
      x: a.x,
      z: a.z - a.length / 2 + 10,
      y: a.height,
      heading: 0,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.down('b');
    await page.keyboard.down('s');
    await expect.poll(() => lastInput?.brake && lastInput?.throttle === -1).toBe(true);
    // Only the starting approach is seeded. All subsequent flight uses actual keys.
    Object.assign(p, { z: a.z - a.length / 2 - 20, y: a.height + 10, speed: 30, engine: true });
    Object.assign(flightState(p, a.height), {
      grounded: false,
      vx: 0,
      vz: 30,
      vy: -3,
      pitch: (-6 * Math.PI) / 180,
      bank: (8 * Math.PI) / 180,
      throttle: 0.25,
    });
    const started = w.time;
    await expect.poll(() => w.time - started, { intervals: [25] }).toBeGreaterThan(1.4);
    await page.keyboard.up('s');
    await page.keyboard.press('ArrowDown', { delay: 250 });
    await expect.poll(() => p.flight?.grounded, { timeout: 30000 }).toBe(true);
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.01);
    await page.keyboard.up('b');
    expect(p.vehicle).toBe(2);
    expect(p.lastFlightCrash).toBeUndefined();
    expect(Math.abs(p.x - a.x)).toBeLessThan(a.width / 2);
    expect(Math.abs(p.z - a.z)).toBeLessThan(a.length / 2);
    await expect(page.locator('#flight-readout')).toContainText('GROUND');
    await page.screenshot({ path: 'test-results/landing-runway.png' });
    await page.keyboard.press('c');
    await page.screenshot({ path: 'test-results/landing-cockpit.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole('button', { name: 'Airbrake and wheel brakes', exact: true }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="flightAirbrake"]').uncheck();
    await rules.locator('[name="flightStrictLanding"]').check();
    await page.screenshot({ path: 'test-results/landing-rules.png' });
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.flightStrictLanding).toBe(true);
    expect(w.settings.flightAirbrake).toBe(false);
    await page.keyboard.press('Escape');
    Object.assign(p, { x: a.x, z: a.z, y: a.height + 0.01, heading: 0, speed: 26 });
    Object.assign(flightState(p, a.height), {
      grounded: false,
      vx: 0,
      vz: 26,
      vy: -5,
      pitch: (-8 * Math.PI) / 180,
      bank: (15 * Math.PI) / 180,
      throttle: 0.2,
    });
    await expect.poll(() => p.vehicle).toBe(5);
    expect(p.lastFlightCrash?.cause).toBe('hard landing');
    await expect(page.locator('#chat-log')).toContainText('hard landing');
    await expect(page.locator('#flight-readout')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/landing-strict-crash.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
