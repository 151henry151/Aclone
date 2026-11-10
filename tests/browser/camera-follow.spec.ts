// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

for (const phone of [false, true])
  test(`automatic follow keeps free look stopped and recenters on movement — ${phone ? 'phone' : 'desktop'}`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    page.setDefaultTimeout(10000);
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    mkdirSync('output/camera-follow', { recursive: true });
    const dir = mkdtempSync(join(tmpdir(), 'aclone-camera-follow-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const { account, token } = app.universe.register('Camera driver');
      const w = createWorld('follow-test', 'Camera follow', account.id);
      Object.assign(w, {
        script: '',
        buildings: [],
        towns: [],
        roads: [],
        resources: {},
        terrain: [],
        airfield: undefined,
        spaceportSite: undefined,
      });
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      w.landscape = {
        paths: [],
        surfaces: [],
        scatter: [],
        barriers: [],
        heightmap: Array(1089).fill(0),
      };
      Object.assign(w.settings, {
        mapSize: 1000,
        seaLevel: -10,
        hungerRate: 0,
        thirstRate: 0,
        time: 43200,
        dayLength: 0,
        vehiclesPersist: false,
        arrivalAnimation: 'off',
        solidScenery: 'off',
        vehicleLicences: false,
        vehicleCollision: 'off',
        roadGrowthPerDay: 0,
      });
      const p = addPlayer(w, account.id, account.name);
      Object.assign(p, {
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        vehicle: 5,
        fleet: [0, 5],
        engine: false,
        speed: 0,
      });
      app.worlds.set(w.id, w);
      await page.route('**/src/client/main.ts', async (route) => {
        const r = await route.fetch();
        await route.fulfill({
          response: r,
          body: (await r.text()) + '\nglobalThis.__followScene=scene;\n',
        });
      });
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'follow-test');
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token },
      );
      const port = await app.listen();
      await page.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(page);
      const toggle = () =>
        phone
          ? page.getByRole('dialog').locator('[data-do="camera-follow"]')
          : page.locator('.bottom-left [data-do="camera-follow"]');
      const openActions = async () => {
        if (phone) await page.locator('[data-do="mobile-actions"]').click();
      };
      const closeActions = async () => {
        if (phone) await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      };
      const state = () =>
        page.evaluate(() => {
          const s = (globalThis as any).__followScene;
          return {
            orbit: s.orbit as number,
            pitch: s.lookPitch as number,
            zoom: s.zoom as number,
            follow: s.autoFollow as boolean,
            mode: s.cameraMode as number,
            speed: s.me.speed as number,
            finite: s.camera.position.toArray().every(Number.isFinite),
          };
        });
      await openActions();
      await expect(toggle()).toHaveText('Camera: Manual');
      await toggle().click();
      await expect(toggle()).toHaveText('Camera: Auto follow');
      await expect(toggle()).toHaveAttribute('aria-pressed', 'true');
      if (phone) {
        await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
        await page.screenshot({ path: 'output/camera-follow/phone-controls.png' });
      }
      await closeActions();
      const orbit = async (hold = false) => {
        if (phone) {
          const cdp = await page.context().newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: 110, y: 300, id: 1 }],
          });
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: 280, y: 360, id: 1 }],
          });
          const release = async () => {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
          };
          if (!hold) await release();
          return release;
        } else {
          await page.mouse.move(720, 330);
          await page.mouse.down();
          await page.mouse.move(920, 410, { steps: 8 });
          const release = async () => {
            await page.mouse.up();
          };
          if (!hold) await release();
          return release;
        }
      };
      await orbit();
      const stopped = await state();
      expect(Math.abs(stopped.orbit)).toBeGreaterThan(0.5);
      await page.waitForTimeout(500);
      expect((await state()).orbit).toBeCloseTo(stopped.orbit, 5);
      await page.screenshot({
        path: `output/camera-follow/${phone ? 'phone' : 'desktop'}-look.png`,
      });
      await page.keyboard.down('w');
      await expect.poll(async () => Math.abs((await state()).orbit)).toBeLessThan(0.04);
      await expect.poll(async () => Math.abs((await state()).pitch)).toBeLessThan(0.04);
      const releaseLook = await orbit(true);
      const held = await state();
      expect(Math.abs(held.orbit)).toBeGreaterThan(0.5);
      await page.waitForTimeout(500);
      expect((await state()).orbit).toBeCloseTo(held.orbit, 5);
      await releaseLook();
      await expect.poll(async () => Math.abs((await state()).orbit)).toBeLessThan(0.04);
      await page.keyboard.down('a');
      await page.waitForTimeout(800);
      await page.keyboard.up('a');
      await page.waitForTimeout(500);
      expect((await state()).finite).toBe(true);
      await page.screenshot({
        path: `output/camera-follow/${phone ? 'phone' : 'desktop'}-follow.png`,
      });
      await page.keyboard.up('w');
      await expect.poll(async () => Math.abs((await state()).speed)).toBeLessThan(0.05);
      await openActions();
      await toggle().click();
      await expect(toggle()).toHaveText('Camera: Manual');
      await closeActions();
      await orbit();
      const manual = await state();
      await page.keyboard.down('w');
      await page.waitForTimeout(600);
      await page.keyboard.up('w');
      expect((await state()).orbit).toBeCloseTo(manual.orbit, 5);
      await openActions();
      await toggle().click();
      await closeActions();
      await page.keyboard.press('c');
      expect((await state()).mode).toBe(1);
      await orbit();
      const cab = await state();
      await page.keyboard.down('w');
      await page.waitForTimeout(500);
      await page.keyboard.up('w');
      expect((await state()).orbit).toBeCloseTo(cab.orbit, 5);
      await page.keyboard.press('c');
      expect((await state()).mode).toBe(2);
      await page.keyboard.down('w');
      await page.waitForTimeout(500);
      await page.keyboard.up('w');
      expect((await state()).orbit).toBeCloseTo(cab.orbit, 5);
      await page.keyboard.press('c');
      await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.05);
      act(w, p.id, { type: 'vehicle', slot: 0 });
      p.engine = true;
      p.fuel = 100;
      await expect
        .poll(() => page.evaluate(() => (globalThis as any).__followScene.me.vehicle))
        .toBe(0);
      await orbit();
      await page.keyboard.down('s');
      await expect.poll(async () => (await state()).speed).toBeLessThan(-0.05);
      await expect.poll(async () => Math.abs((await state()).orbit)).toBeLessThan(0.04);
      await page.keyboard.up('s');
      expect((await state()).finite).toBe(true);
      await page.reload();
      await waitForWorld(page);
      expect((await state()).follow).toBe(true);
      await openActions();
      await expect(toggle()).toHaveText('Camera: Auto follow');
      await closeActions();
      if (phone) {
        await expect.poll(async () => Math.abs((await state()).speed)).toBeLessThan(0.05);
        await orbit();
        const pedal = await page.locator('[data-hold="forward"]').boundingBox();
        expect(pedal).not.toBeNull();
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: pedal!.x + pedal!.width / 2, y: pedal!.y + pedal!.height / 2, id: 4 }],
        });
        await expect.poll(async () => (await state()).speed).toBeGreaterThan(0.05);
        await expect.poll(async () => Math.abs((await state()).orbit)).toBeLessThan(0.04);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await touch.detach();
      }
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
