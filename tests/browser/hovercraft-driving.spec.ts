// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { hovercraftWorld } from '../fixtures/hovercraft-world';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('keyboard hovercraft drifts, settles, stops, reverses, floats and accepts legacy rule', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-hover-drift-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let lastInput: any;
  page.on('websocket', (socket) =>
    socket.on('framesent', ({ payload }) => {
      const msg = JSON.parse(String(payload));
      if (msg.type === 'input') lastInput = msg.input;
    }),
  );
  try {
    const { account, token } = app.universe.register('Hovercraft driver');
    const { w, p } = hovercraftWorld('hovercraft-driving', account.id);
    p.speed = 0;
    // Visible road gives the real game view a fixed reference for the sideways slide.
    w.roads = [{ a: { x: 0, z: -500 }, b: { x: 0, z: 500 }, width: 6 }];
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.goto(`http://127.0.0.1:${await app.listen()}`);
    await waitForWorld(page);
    mkdirSync('output/hovercraft-drift', { recursive: true });
    const drift = () =>
      Math.abs(
        Math.atan2(
          Math.sin(Math.atan2(p.hoverVelocity?.x ?? 0, p.hoverVelocity?.z ?? 0) - p.heading),
          Math.cos(Math.atan2(p.hoverVelocity?.x ?? 0, p.hoverVelocity?.z ?? 0) - p.heading),
        ),
      );
    await page.keyboard.down('w');
    await expect.poll(() => p.speed).toBeGreaterThan(18);
    await page.keyboard.down('d');
    await expect.poll(() => drift(), { intervals: [50] }).toBeGreaterThan(0.5);
    await page.screenshot({ path: 'output/hovercraft-drift/turning.png' });
    await page.keyboard.up('d');
    await expect.poll(() => drift(), { timeout: 12000 }).toBeLessThan(0.02);
    expect(p.y).toBe(20.5);
    await page.keyboard.up('w');
    await expect.poll(() => p.speed).toBeLessThan(0.01);
    await page.keyboard.down('s');
    await expect.poll(() => p.speed).toBeLessThan(-1);
    expect(p.speed).toBeGreaterThanOrEqual(-8);
    expect(p.hoverVelocity).toBeUndefined();
    await page.keyboard.up('s');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.01);
    // Exercise the existing blocked-state flow using a local parked obstacle.
    w.parkedVehicles = {
      block: {
        owner: 'other',
        slot: 0,
        x: p.x + Math.sin(p.heading) * 8,
        z: p.z + Math.cos(p.heading) * 8,
        y: 20,
        heading: p.heading,
        fuel: 0,
        condition: 100,
        parkedAt: 0,
      },
    };
    w.revision++;
    await page.keyboard.down('w');
    await expect.poll(() => lastInput?.throttle).toBe(1);
    await expect.poll(() => p.speed, { intervals: [20] }).toBeGreaterThan(0.1);
    await expect.poll(() => p.speed, { intervals: [20] }).toBe(0);
    await page.keyboard.up('w');
    await expect.poll(() => lastInput?.throttle).toBe(0);
    const blocked = { x: p.x, z: p.z };
    await page.waitForTimeout(500);
    expect(p.speed).toBe(0);
    expect(p.x).toBe(blocked.x);
    expect(p.z).toBe(blocked.z);
    await page.keyboard.up('w');
    w.parkedVehicles = {};
    w.revision++;
    await expect.poll(() => lastInput?.throttle).toBe(0);
    p.fuel = 0;
    p.speed = 0;
    await page.keyboard.down('w');
    await expect.poll(() => lastInput?.throttle).toBe(1);
    await page.waitForTimeout(500);
    expect(p.speed).toBe(0);
    await page.screenshot({ path: 'output/hovercraft-drift/empty-tank.png' });
    await page.keyboard.up('w');
    await expect.poll(() => lastInput?.throttle).toBe(0);
    p.fuel = 40;
    p.engine = true;
    w.settings.seaLevel = 30;
    p.y = 30.5;
    w.revision++;
    await page.keyboard.down('w');
    await expect.poll(() => p.speed).toBeGreaterThan(15);
    await page.keyboard.down('d');
    await expect.poll(() => drift()).toBeGreaterThan(0.4);
    expect(p.y).toBe(30.5);
    await page.screenshot({ path: 'output/hovercraft-drift/water-turn.png' });
    await page.keyboard.up('d');
    await page.keyboard.up('w');
    await expect.poll(() => p.speed).toBeLessThan(0.01);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.locator('#settings-form');
    await rules.locator('[name="hovercraftDriftSeconds"]').fill('0');
    await rules.locator('[name="hovercraftDriftSeconds"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/hovercraft-drift/world-rules.png' });
    await rules.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.hovercraftDriftSeconds).toBe(0);
    await page.keyboard.press('Escape');
    await page.keyboard.down('w');
    await expect.poll(() => p.speed).toBeGreaterThan(15);
    await page.keyboard.down('d');
    await expect.poll(() => lastInput?.steer).not.toBe(0);
    const heading = p.heading;
    await expect.poll(() => Math.abs(p.heading - heading)).toBeGreaterThan(0.5);
    expect(p.hoverVelocity).toBeUndefined();
    await page.keyboard.up('d');
    await page.keyboard.up('w');
    expect(errors).toEqual([]);
  } finally {
    const video = page.video();
    await page.close();
    if (video) await video.saveAs('output/hovercraft-drift/handling-and-world-rule.webm');
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
