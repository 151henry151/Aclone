// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('rescue boat fuel stays visible and can be poured into the active tank', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-refuel-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    const w = app.worlds.get('puddlewick')!;
    // This is an inventory/boat-state regression, not a town rendering test.
    w.buildings = [];
    w.script = '';
    w.creator = creatorSchema.parse({ ...w.creator, scenery: false, weather: 'clear' });
    w.settings.oceanWaves = 0;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const { account, token } = app.universe.register('Recovery skipper');
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 32,
      fuelVehicle: 32,
      fuel: 0,
      engine: false,
      inventory: { fuel: 2 },
      fleet: [0, 5, 30, 32, 33],
      x: 0,
      z: 1000,
      y: 0,
    });
    w.boatRescues = {
      [p.id]: {
        boat: { x: 0, z: 2000, heading: 0, slot: 30, paint: 'blue' },
        cargo: {},
        dinghy: { x: 0, z: 300, heading: 0, moored: true },
      },
    };
    await page.setViewportSize({ width: 960, height: 640 });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const fuel = page.locator('#bag button[data-id="fuel"]');
    await expect(fuel).toBeVisible();
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Refuel', exact: true }).click();
    await expect.poll(() => p.fuel).toBe(8);
    expect(p.inventory.fuel).toBe(1);
    await page.keyboard.press('Escape');
    // Reproduce the old disappearing row when fuel use is blocked on a lifeboat.
    Object.assign(p, { vehicle: 29, fuelVehicle: 30, fuel: 0 });
    await expect(fuel).toHaveAttribute('data-do', 'inventory');
    await expect(fuel).toBeVisible();
    await fuel.click();
    await expect(page.locator('.item-list')).toContainText('Fuel');
    expect(p.inventory.fuel).toBe(1);
    expect(p.fuel).toBe(0);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
