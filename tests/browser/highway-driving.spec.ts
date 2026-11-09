// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { fifthWheel, kingpin } from '../../src/shared/highway-geometry';
import { waitForWorld } from './fixtures/ready';
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('reverse, brake, couple, load and drive a full rig using keyboard, controller and mobile brakes', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-rig-controls-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const evidence = 'output/automotive-factory/rig-browser';
  mkdirSync(evidence, { recursive: true });
  try {
    const { account, token } = app.universe.register('Rig driver'),
      w = createWorld('rig-controls', 'Highway driving yard', account.id);
    w.script = '';
    w.towns = [];
    w.buildings = [];
    w.terrain = [];
    w.zones = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(20),
    };
    Object.assign(w.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      arrivalAnimation: 'off',
      vehiclesPersist: true,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: 0,
      y: 20,
      heading: 0,
      vehicle: 37,
      fleet: [0, 5, 37],
      engine: true,
      fuel: 320,
      fuelVehicle: 37,
      inventory: { wood: 20 },
      skills: ['driver'],
    });
    const t = {
      id: 'owned-box',
      owner: p.id,
      kind: 'semiBox' as const,
      x: 0,
      z: -12,
      heading: 0,
      cargo: {} as Record<string, number>,
      attached: undefined as string | undefined,
    };
    w.trailers = { [t.id]: t };
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        (window as any).__rigPad = null;
        Object.defineProperty(navigator, 'getGamepads', {
          value: () => [(window as any).__rigPad],
        });
      },
      { token, id: w.id },
    );
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    const gap = () => {
      const a = fifthWheel(w, p),
        b = kingpin(w, t);
      return Math.hypot(a.x - b.x, a.z - b.z);
    };
    expect(gap()).toBeGreaterThan(3);
    await page.keyboard.down('s');
    await expect.poll(gap, { intervals: [50], timeout: 10000 }).toBeLessThan(0.7);
    await page.keyboard.up('s');
    await page.keyboard.down('b');
    await expect
      .poll(() => Math.abs(p.speed), { intervals: [50], timeout: 700 })
      .toBeLessThan(0.05);
    await page.keyboard.up('b');
    expect(gap()).toBeLessThan(1);
    await page.keyboard.press('i');
    const panel = page
      .locator('section.notice')
      .filter({ has: page.getByRole('heading', { name: 'Box semitrailer', exact: true }) });
    await panel.getByRole('button', { name: 'Hitch trailer', exact: true }).click();
    await expect.poll(() => t.attached).toBe(p.id);
    await expect(panel).toContainText('Hitched');
    const loading = panel
      .locator('form')
      .filter({ has: page.getByRole('button', { name: 'Load', exact: true }) });
    await loading.getByLabel('Quantity', { exact: true }).fill('20');
    await loading.getByRole('button', { name: 'Load', exact: true }).click();
    await expect.poll(() => t.cargo.wood).toBe(20);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Hide chat', exact: true }).click();
    const before = { x: p.x, z: p.z };
    await page.keyboard.down('w');
    await page.waitForTimeout(3500);
    await page.keyboard.down('a');
    await page.waitForTimeout(3000);
    await page.keyboard.up('a');
    await page.keyboard.up('w');
    await page.keyboard.down('b');
    await expect
      .poll(() => Math.abs(p.speed), { timeout: 700, intervals: [50] })
      .toBeLessThan(0.05);
    await page.keyboard.up('b');
    expect(Math.hypot(p.x - before.x, p.z - before.z)).toBeGreaterThan(5);
    expect(Math.abs(t.heading)).toBeGreaterThan(0.01);
    expect(gap()).toBeLessThan(0.001);
    await page.mouse.move(750, 450);
    await page.mouse.down();
    await page.mouse.move(1020, 450, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(750);
    await page.screenshot({ path: evidence + '/loaded-rig-turn.png' });
    await page.mouse.move(1020, 450);
    await page.mouse.down();
    await page.mouse.move(750, 450, { steps: 20 });
    await page.mouse.up();
    await page.keyboard.press('c');
    await page.waitForTimeout(500);
    await page.screenshot({ path: evidence + '/cab-controls.png' });
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    w.settings.time = 0;
    await page.keyboard.press('l');
    await expect.poll(() => p.lights).toBe(true);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: evidence + '/rig-night.png' });
    await page.evaluate(() => {
      (window as any).__rigPad = {
        connected: true,
        axes: [0, -1, 0, 0],
        buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
      };
    });
    await expect.poll(() => p.speed).toBeGreaterThan(1);
    await page.evaluate(() => {
      const p = (window as any).__rigPad;
      p.axes[1] = 0;
      p.buttons[4] = { pressed: true, value: 1 };
    });
    await expect
      .poll(() => Math.abs(p.speed), { timeout: 700, intervals: [50] })
      .toBeLessThan(0.05);
    await page.evaluate(() => {
      (window as any).__rigPad = null;
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const forward = page.getByRole('button', { name: 'Accelerate or walk forward', exact: true }),
      brake = page.getByRole('button', { name: 'Wheel brakes', exact: true });
    await expect(brake).toBeVisible();
    const box = await forward.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await expect.poll(() => p.speed).toBeGreaterThan(1);
    await page.mouse.up();
    const pedal = await brake.boundingBox();
    await page.mouse.move(pedal!.x + pedal!.width / 2, pedal!.y + pedal!.height / 2);
    await page.mouse.down();
    await expect
      .poll(() => Math.abs(p.speed), { timeout: 700, intervals: [50] })
      .toBeLessThan(0.05);
    await page.mouse.up();
    await page.screenshot({ path: evidence + '/mobile-brakes.png' });
    await page.getByRole('button', { name: 'Bag', exact: true }).click();
    await panel.getByRole('button', { name: 'Unhitch here', exact: true }).click();
    await expect.poll(() => t.attached).toBeUndefined();
    expect(t.cargo.wood).toBe(20);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
