// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { oceanWeather, surfaceWaterLevel } from '../../src/shared/ocean';
import { capsizeRisk } from '../../src/shared/storm-capsizing';
import { waitForWorld } from './fixtures/ready';

test('forecast warns a rower, shelter resets exposure, and a capsize respawns everyone aboard', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-storm-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Shelter skipper');
  const w = createWorld('puddlewick', 'Storm shelter', account.id);
  w.script = '';
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    tidalRange: 0,
    vehicleLicences: false,
    parishOrders: false,
    loseBoatsOnDeath: false,
  });
  w.creator = creatorSchema.parse({ weather: 'natural' });
  let onset = 0;
  for (let t = 5; t < 30000; t += 5)
    if (oceanWeather({ ...w, time: t }).storm && !oceanWeather({ ...w, time: t - 5 }).storm) {
      onset = t;
      break;
    }
  expect(onset).toBeGreaterThan(0);
  w.time = onset - 150;
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    vehicle: 36,
    fleet: [0, 5, 36],
    inventory: { wood: 2 },
    x: 0,
    z: 320,
    y: surfaceWaterLevel(w, 0, 320),
    heading: Math.PI,
    speed: 0,
  });
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!,
    me = () => current().players[p.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const port = await app.listen();
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'normal');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await expect(page.locator('[data-marine-safety]')).toContainText(/Storm in the .* forecast/);
    await expect
      .poll(() =>
        current().messages.some((m) => m.name === 'Storm warning' && /forecast/.test(m.text)),
      )
      .toBe(true);
    current().creator!.weather = 'thunderstorm';
    await expect(page.locator('[data-marine-safety]')).toContainText('Storm at sea');
    await expect.poll(() => me().stormExposure?.safeUntil ?? 0).toBeGreaterThan(current().time);
    await expect(page.locator('[data-marine-safety]')).toContainText('guaranteed escape time');
    await page.screenshot({ path: 'output/rowboats/storm-warning.png' });
    await close();
    await page.keyboard.press('h');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.mouse.wheel(0, -600);
    await page.screenshot({ path: 'output/rowboats/storm-at-sea.png' });
    await page.keyboard.press('h');
    // Approach the same real shoreline using ordinary rowing input.
    Object.assign(me(), { x: 0, z: 265, heading: Math.PI, speed: 0 });
    await page.keyboard.down('w');
    await expect.poll(() => capsizeRisk(current(), me()).rate, { timeout: 30000 }).toBe(0);
    await page.keyboard.up('w');
    await expect.poll(() => me().stormExposure).toBeUndefined();
    expect(me().deaths).toBe(0);
    // A local deterministic high-risk world verifies the actual death/recovery UI.
    Object.assign(current().settings, {
      capsizeSmallRate: 1,
      capsizeGraceSeconds: 0,
      capsizeEscapeMultiplier: 0,
      capsizeTurnSeconds: 0,
      capsizeRampSeconds: 0,
    });
    Object.assign(me(), {
      x: 0,
      z: 500,
      y: surfaceWaterLevel(current(), 0, 500),
      speed: 0,
      heading: 0.5,
    });
    const passenger = addPlayer(current(), 'passenger', 'Boat passenger');
    Object.assign(passenger, { vehicle: 5, hitch: p.id, x: 0, z: 500, y: 2, online: true });
    await expect.poll(() => me().deaths, { timeout: 20000 }).toBe(1);
    expect(current().players.passenger.deaths).toBe(1);
    expect(me().vehicle).toBe(5);
    expect(current().boatRescues![p.id].boat.slot).toBe(36);
    await expect(page.locator('#chat-log')).toContainText('capsized');
    await page.keyboard.press('i');
    await expect(
      page.getByRole('button', { name: 'Show route to stranded boat' }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
