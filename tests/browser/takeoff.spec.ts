// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { flightState } from '../../src/shared/flight';
import { ensurePuddlewickAirfield } from '../../src/server/puddlewick-airfield';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('keyboard rotation lifts off the public strip; neutral/short rolls stay down and takeoff rules save', async ({
  page,
}) => {
  test.setTimeout(240000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-takeoff-'));
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
    const { account, token } = app.universe.register('Runway pilot');
    const w = createWorld('puddlewick', 'Puddlewick', 'server');
    w.towns[0].radius = 310;
    w.settings.runwayLength = 220;
    expect(ensurePuddlewickAirfield(w)).toBe(true);
    const a = w.airfield!;
    w.owner = account.id;
    w.script = '';
    w.creator = creatorSchema.parse({ scenery: false, weather: 'clear' });
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 2,
      fleet: [0, 5, 2],
      skills: ['pilot'],
      fuel: 50,
      engine: false,
      inventory: { fuel: 45 },
      x: a.x,
      z: a.z - a.length / 2 + 2,
      y: a.height,
      heading: 0,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await expect(page.locator('#flight-readout')).toContainText('GROUND');
    p.engine = true;
    await page.keyboard.down('w');
    await expect.poll(() => p.speed, { intervals: [50] }).toBeGreaterThanOrEqual(19);
    expect(p.flight!.grounded).toBe(true);
    await page.keyboard.down('ArrowDown');
    await expect.poll(() => p.flight!.grounded, { intervals: [50] }).toBe(false);
    expect(p.z).toBeLessThan(a.z + a.length / 2);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('w');
    await expect.poll(() => p.y).toBeGreaterThan(a.height + 4);
    mkdirSync('output/runway-takeoff', { recursive: true });
    await page.screenshot({ path: 'output/runway-takeoff/keyboard-liftoff.png' });
    expect(p.vehicle).toBe(2);
    expect(p.lastFlightCrash).toBeUndefined();

    async function reset(length: number) {
      await page.keyboard.down('b');
      await expect
        .poll(() => lastInput?.brake && lastInput?.throttle === 0 && lastInput?.pitch === 0)
        .toBe(true);
      a.length = length;
      w.revision++;
      Object.assign(p, {
        vehicle: 2,
        x: a.x,
        z: a.z - length / 2 + 2,
        y: a.height,
        heading: 0,
        speed: 0,
        fuel: 50,
        engine: true,
      });
      delete p.flight;
      flightState(p, p.y);
      await page.keyboard.up('b');
      await expect.poll(() => lastInput?.brake).toBe(false);
    }
    await reset(220);
    await page.keyboard.down('w');
    await expect.poll(() => p.z, { intervals: [25] }).toBeGreaterThan(a.z + a.length / 2 - 25);
    expect(p.flight!.grounded).toBe(true);
    await page.keyboard.up('w');
    await reset(40);
    await page.keyboard.down('w');
    await page.keyboard.down('ArrowDown');
    await expect.poll(() => p.z, { intervals: [25] }).toBeGreaterThan(a.z + a.length / 2 - 10);
    expect(p.flight!.grounded).toBe(true);
    await page.keyboard.up('w');
    await page.keyboard.up('ArrowDown');
    await reset(220);
    p.engine = false;
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="flightRotationSpeed"]').fill('22');
    await rules.locator('[name="flightTakeoffPitch"]').fill('6');
    await rules.locator('[name="flightTakeoffLift"]').fill('0.8');
    await rules.locator('[name="flightRotationSpeed"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/runway-takeoff/world-takeoff-rules.png' });
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.flightRotationSpeed).toBe(22);
    expect(w.settings.flightTakeoffPitch).toBe(6);
    expect(w.settings.flightTakeoffLift).toBe(0.8);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
