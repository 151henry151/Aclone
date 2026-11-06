// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { boatLandings } from '../../src/shared/boathouse';
import { travelHeight } from '../../src/shared/dock';
import { waitForWorld } from './fixtures/ready';
test('builder previews an invalid and valid quay, builds it, and uses its freight berth', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'quay-browser-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Harbour builder');
  const w = createWorld('quay-browser', 'Coastal freight quay', account.id);
  w.script = '';
  w.buildings = [];
  w.roads = [];
  w.zones = [];
  w.towns = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
  Object.assign(w.settings, {
    seaLevel: 0,
    tidalRange: 0,
    mapSize: 1000,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    requireCaptainSkill: false,
    vehicleLicences: false,
    parishOrders: false,
  });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) =>
      Math.floor(i / 33) < 16 ? 2 : Math.floor(i / 33) === 16 ? 1 : -5,
    ),
  };
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: -300,
    z: 0,
    y: 1,
    vehicle: 0,
    engine: false,
    fleet: [0, 5, 35],
    cash: 10000000,
    inventory: { wood: 80 },
    parkedFuel: { 35: 320 },
    fuelVehicle: 0,
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
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.locator('[data-do="construction"]:visible').click();
    await page.getByLabel('Building type', { exact: true }).selectOption('quay');
    await expect(
      page.getByRole('button', { name: 'Place foundation', exact: true }),
    ).toBeDisabled();
    await expect(page.locator('[data-build-estimate]')).toContainText('2 m');
    for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Rotate right' }).click();
    await expect(page.getByRole('button', { name: 'Place foundation', exact: true })).toBeEnabled();
    await expect(page.locator('[data-build-estimate]')).toContainText('80 Wood');
    await expect(page.locator('[data-build-estimate]')).toContainText('100 Stone');
    await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/cargo-boat/quay-preview.png' });
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => current().buildings.length).toBe(1);
    await page.locator('#target').click();
    await page.getByRole('button', { name: 'Deliver construction materials', exact: true }).click();
    await expect.poll(() => me().inventory.wood ?? 0).toBe(0);
    // Independent supply fixtures deliver the remaining construction materials in legal loads.
    for (const inventory of [
      { stone: 75, steel: 0 },
      { stone: 25, steel: 20 },
    ]) {
      me().inventory = inventory;
      await page
        .getByRole('button', { name: 'Deliver construction materials', exact: true })
        .click();
      await expect.poll(() => Object.values(me().inventory).reduce((s, n) => s + n, 0)).toBe(0);
    }
    await expect.poll(() => current().buildings[0].construction).toBeUndefined();
    const d = boatLandings(current()).find((d) => d.id === current().buildings[0].id)!;
    expect(d).toBeTruthy();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    Object.assign(me(), d.land, {
      vehicle: 5,
      y: travelHeight(current(), d.land.x, d.land.z),
      inventory: { stone: 10 },
    });
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Board your Coastal cargo boat', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(35);
    const panel = page.locator('[data-freight-slot="35"]');
    await expect(panel).toContainText('Hold empty');
    const load = panel
      .locator('form[data-action="boatHold"]')
      .filter({ has: page.locator('[name="operation"][value="load"]') })
      .filter({ hasNot: page.locator('[name="building"]') });
    await load.locator('[name="quantity"]').fill('10');
    await load.getByRole('button', { name: 'Load inventory', exact: true }).click();
    await expect.poll(() => me().boatHold?.stone).toBe(10);
    await expect(panel).toContainText('Load stockroom: no stock available.');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    // Sail out and reverse back under the real keyboard controls, carrying the loaded hold.
    const distance = () => Math.hypot(me().x - d.berth.x, me().z - d.berth.z);
    await page.keyboard.press('F4');
    await expect.poll(() => me().engine).toBe(true);
    await page.keyboard.down('w');
    await expect.poll(() => me().boatThrottle ?? 0).toBeGreaterThan(0.95);
    await page.keyboard.up('w');
    await expect.poll(distance, { timeout: 30000 }).toBeGreaterThan(45);
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    await page.keyboard.up('b');
    await page.keyboard.press('i');
    await expect(panel).toContainText('Return to this boat at its dock or landing');
    await expect(panel.locator('form')).toHaveCount(0);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('c');
    await page.keyboard.press('h');
    await page.screenshot({ path: 'output/cargo-boat/coaster-helm-low.png' });
    await page.keyboard.press('h');
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    await page.keyboard.down('s');
    await expect.poll(() => me().boatThrottle ?? 0).toBeLessThan(-0.39);
    await page.keyboard.up('s');
    await expect.poll(distance, { timeout: 40000 }).toBeLessThan(8);
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    await page.keyboard.up('b');
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(5);
    expect(current().mooredBoats![me().id + ':35'].cargo?.stone).toBe(10);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Board your Coastal cargo boat', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(35);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.evaluate(() => localStorage.setItem('aclone.quality', 'normal'));
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('h');
    await page.mouse.move(720, 400);
    await page.mouse.wheel(0, 650);
    await page.mouse.down();
    await page.mouse.move(920, 500, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/cargo-boat/coaster-quay-normal.png' });
    await page.keyboard.press('h');

    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
