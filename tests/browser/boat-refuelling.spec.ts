// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer, createWorld } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('rescue boat fuel stays visible and can be poured into the active tank', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-refuel-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    const { account, token } = app.universe.register('Recovery skipper');
    const w = createWorld('refuel', 'Refuelling', account.id);
    app.worlds.set(w.id, w);
    // This is an inventory/boat-state regression, not a town rendering test.
    w.buildings = [];
    w.script = '';
    w.creator = creatorSchema.parse({ ...w.creator, scenery: false, weather: 'clear' });
    w.settings.oceanWaves = 0;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      vehicle: 32,
      fuelVehicle: 32,
      fuel: 0,
      engine: false,
      inventory: { fuel: 3 },
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
      localStorage.setItem('aclone.world', 'refuel');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const fuel = page.locator('#bag button[data-id="fuel"]');
    await expect(fuel).toBeVisible();
    await page.keyboard.press('i');
    await expect(page.getByRole('dialog')).toContainText('Each can adds up to 8 tank units');
    await page.getByRole('button', { name: 'Refuel', exact: true }).click();
    await expect.poll(() => p.fuel).toBe(8);
    expect(p.inventory.fuel).toBe(2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await page
      .getByRole('group', { name: 'Roadside fuel', exact: true })
      .locator('[name="fuelUnitsPerItem"]')
      .fill('12');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.fuelUnitsPerItem).toBe(12);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('i');
    await expect(page.getByRole('dialog')).toContainText('Each can adds up to 12 tank units', {
      timeout: 5000,
    });
    await page.getByRole('button', { name: 'Refuel', exact: true }).click();
    await expect.poll(() => p.fuel).toBe(20);
    expect(p.inventory.fuel).toBe(1);
    await expect(async () => {
      await page.getByText('Boating', { exact: true }).scrollIntoViewIfNeeded();
    }).toPass({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/boat-refuel-custom.png' });
    await page.keyboard.press('Escape');
    // Reproduce the old disappearing row when fuel use is blocked on a lifeboat.
    Object.assign(p, { vehicle: 29, fuelVehicle: 30, fuel: 0 });
    await expect(fuel).toHaveAttribute('data-do', 'inventory');
    await expect(fuel).toBeVisible();
    await fuel.click();
    await expect(page.locator('.item-list')).toContainText('Fuel');
    expect(p.inventory.fuel).toBe(1);
    expect(p.fuel).toBe(0);
    await page.screenshot({ path: 'test-results/boat-refuel-blocked.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
