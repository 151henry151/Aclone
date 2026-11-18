// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { garageBay, garageBayStoreReason } from '../../src/shared/garage-bay';
import { automotiveConfig } from '../../src/shared/automotive-config';
import { trailerDef } from '../../src/shared/trailers';
import { waitForWorld } from './fixtures/ready';

test('drive a complete highway rig into the yellow bay, store from the HUD, leave on foot and retrieve', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-storage-bay-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  mkdirSync('output/garage-bay/browser', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Bay driver');
    const initial = createWorld('bay', 'Marked garage storage', account.id);
    Object.assign(initial, {
      script: '',
      roads: [],
      towns: [],
      zones: [],
      terrain: [],
      airfield: undefined,
      spaceportSite: undefined,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      scatter: [],
      barriers: [],
      heightmap: Array(1089).fill(0),
    };
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: -10,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      vehiclesPersist: true,
      garageStoresSpareTractors: false,
      arrivalAnimation: 'quick',
      vehicleMaintenance: false,
    });
    const b = makeBuilding('garage', 'garage', 0, 0);
    initial.buildings = [b];
    initial.parkedVehicles = {};
    const bay = garageBay(initial, b)!;
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: bay.x,
      z: bay.z + bay.depth / 2 + 5,
      y: 0,
      heading: Math.PI,
      vehicle: 37,
      fleet: [0, 5, 37],
      fuel: 200,
      fuelVehicle: 37,
      speed: 0,
      engine: true,
      skills: ['driver'],
      inventory: {},
      cash: 100000,
    });
    const d = trailerDef(initial, 'semiStake'),
      c = automotiveConfig(initial).coupling;
    const offset = c.fifthWheelZ - d.length / 2 + c.kingpinInset;
    initial.trailers = {
      rig: {
        id: 'rig',
        owner: player.id,
        attached: player.id,
        kind: 'semiStake',
        x: player.x,
        z: player.z - offset,
        heading: Math.PI,
        cargo: { wood: 3 },
      },
    };
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const p = () => w().players[player.id];
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__bayScene=scene;\n',
      });
    });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'bay');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${await app.listen()}`);
    await waitForWorld(page);
    const store = page.getByRole('button', { name: 'Store vehicle', exact: true });
    await expect(store).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          let count = 0;
          (globalThis as any).__bayScene.scene.traverse((n: any) => {
            if (n.name === 'garage-storage-bay') count++;
          });
          return count;
        }),
      )
      .toBe(1);
    await page.keyboard.down('w');
    await expect.poll(() => p().speed).toBeGreaterThan(1);
    await expect(store).toHaveCount(0);
    await expect.poll(() => p().z).toBeLessThan(bay.z - 3);
    await page.keyboard.up('w');
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(p().speed)).toBeLessThan(0.05);
    await page.keyboard.up('b');
    await expect(store).toBeVisible();
    expect(garageBayStoreReason(w(), p(), b)).toBeUndefined();
    await page.screenshot({ path: 'output/garage-bay/browser/ready-to-store.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(store).toBeInViewport();
    await page.screenshot({ path: 'output/garage-bay/browser/phone-store.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const fuel = p().fuel;
    await store.click();
    const panel = page.locator('[data-garage-storage]');
    await expect(panel).toBeVisible();
    expect(p().vehicle).toBe(5);
    const key = player.id + ':37';
    expect(w().parkedVehicles![key].inside).toBe(b.id);
    expect(w().parkedVehicles![key].fuel).toBeCloseTo(fuel, 0);
    expect(w().trailers!.rig.parkedWith).toBe(key);
    expect(w().trailers!.rig.cargo).toEqual({ wood: 3 });
    await page.setViewportSize({ width: 1440, height: 900 });
    await panel.locator('summary').click();
    const retrieve = page
      .locator('[data-garage-unit="Vehicle:37"]')
      .getByRole('button', { name: 'Retrieve outside' });
    await expect(retrieve).toBeVisible();
    await page.screenshot({ path: 'output/garage-bay/browser/stored-rig.png' });
    // Keep the existing safe-retrieval refusal: no destination fits this search area.
    w().settings.parkingSearchRange = 5;
    await retrieve.click();
    await expect(
      page.getByText('No safe clear space outside this garage; clear the exit and try again', {
        exact: true,
      }),
    ).toBeVisible();
    expect(w().parkedVehicles![key].inside).toBe(b.id);
    w().settings.parkingSearchRange = 30;
    await retrieve.click();
    await expect.poll(() => w().parkedVehicles![key].inside).toBeUndefined();
    expect(w().trailers!.rig.cargo).toEqual({ wood: 3 });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await expect.poll(() => p().inside).toBeUndefined();
    await expect.poll(() => p().task).toBeUndefined();
    expect(p().vehicle).toBe(5);
    await expect(store).toHaveCount(0);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.getByRole('group', { name: 'Parked vehicles and arrivals', exact: true });
    await rules.locator('[name="garageBayMargin"]').fill('6');
    await rules.locator('[name="garageBayRequired"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.garageBayMargin).toBe(6);
    await expect.poll(() => w().settings.garageBayRequired).toBe(false);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(rules.locator('[name="garageBayMargin"]')).toHaveValue('6');
    await expect(rules.locator('[name="garageBayRequired"]')).not.toBeChecked();
    await rules.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/garage-bay/browser/saved-rules.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('phone storage action keeps readable contrast with the actual responsive styles', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(
    '<body class="mobile-ui"><div id="target"><button class="wide primary">Store vehicle</button></div></body>',
  );
  for (const path of ['src/client/style.css', 'src/client/mobile.css'])
    await page.addStyleTag({ content: readFileSync(path, 'utf8') });
  const contrast = await page.getByRole('button', { name: 'Store vehicle' }).evaluate((button) => {
    for (const animation of button.getAnimations()) animation.finish();
    const style = getComputedStyle(button);
    const luminance = (css: string) => {
      const rgb = css
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const a = luminance(style.color),
      b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
