// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('running rules persist and garage shows local wear empty history and invalid settings', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-running-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Motorist'),
      initial = createWorld('running', 'Running costs', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.zones = [];
    initial.resources = {};
    Object.assign(initial.settings, { mapSize: 1000, seaLevel: -50, hungerRate: 0, thirstRate: 0 });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const garage = makeBuilding('garage-demo', 'garage', 0, 0);
    initial.buildings = [garage];
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 0,
      z: 13,
      y: 0,
      heading: Math.PI,
      vehicle: 0,
      fuelVehicle: 0,
      fuel: 64,
      engine: true,
      speed: 0,
      inventory: { steel: 1 },
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: initial.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      edit = async () => {
        await page.keyboard.press('F10');
        await page.getByRole('button', { name: 'Rules', exact: true }).click();
      },
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const group = page.getByRole('group', { name: 'Vehicle running costs', exact: true }),
      patch = {
        vehicleWearPerMetre: 0.01,
        trailerSpeedBase: 2,
        trailerFuelBase: 3,
        trailerLoadSpeedPenalty: 0.5,
        trailerLoadFuelPenalty: 0.8,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.vehicleWearPerMetre).toBe(0.01);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vehicle-running-settings.png' });
    await close();
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('no journey recorded yet');
    await expect(dialog).toContainText('Travel wears 10 condition points per kilometre');
    await expect(
      dialog.getByRole('button', { name: 'Service vehicle', exact: true }),
    ).toBeDisabled();
    const before = JSON.stringify(p());
    expect(() => act(w(), p().id, { type: 'serviceVehicle', building: garage.id })).toThrow(
      /condition/,
    );
    expect(JSON.stringify(p())).toBe(before);
    await dialog
      .getByRole('heading', { name: 'Vehicle service', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vehicle-running-unused.png' });
    await close();
    // Reverse away from the garage with actual browser input; both prediction and server record wear.
    await page.keyboard.down('s');
    await expect.poll(() => p().fleetState?.[0]?.metres ?? 0).toBeGreaterThan(15);
    await page.keyboard.up('s');
    await page.keyboard.press('b');
    await expect.poll(() => Math.abs(p().speed)).toBeLessThan(0.5);
    const rec = p().fleetState![0];
    expect(rec.condition).toBeCloseTo(100 - rec.metres * 0.01, 6);
    // Return the isolated fixture to its service approach without inventing travel mileage.
    Object.assign(p(), { x: 0, z: 13, y: 0, heading: Math.PI, speed: 0 });
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('e');
    await expect(dialog).toContainText('hours since first recorded use');
    await expect(dialog).toContainText(`condition ${p().fleetState![0].condition.toFixed(1)}%`);
    await dialog
      .getByRole('heading', { name: 'Vehicle service', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vehicle-running-travelled.png' });
    await close();
    await edit();
    const invalid = group.locator('[name="vehicleWearPerMetre"]');
    await invalid.fill('-0.1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vehicle-running-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(invalid).toHaveValue('0.01');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
