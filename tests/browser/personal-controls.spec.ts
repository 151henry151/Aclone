// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('walking and the lifeboat hide motor readouts while retaining their own controls', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-personal-controls-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const { account, token } = app.universe.register('Walking pilot');
    const w = createWorld('personal-controls', 'Personal controls', account.id);
    w.script = '';
    w.settings.mapSize = 500;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.buildings = [];
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { fuel: 32, fuelVehicle: 0, engine: false, inventory: {} });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const fuel = page
      .locator('#needs .need')
      .filter({ has: page.getByText('Fuel', { exact: true }) });
    const engine = page.locator('.bottom-left [data-do="engine"]');
    await expect(fuel).toBeVisible();
    await expect(fuel).toContainText('50%');
    await expect(engine).toBeVisible();
    await page.keyboard.press('i');
    await page.getByRole('dialog').locator('[data-do="walk"]').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => p.vehicle).toBe(5);
    await expect(fuel).toHaveCount(0);
    await expect(engine).toBeHidden();
    await expect(page.locator('#driving')).not.toContainText(/ENGINE ON|ENGINE OFF/);
    const flashlight = page.locator('.bottom-left [data-do="lights"]');
    await expect(flashlight).toHaveText('Flashlight');
    const lights = p.lights;
    await flashlight.click();
    await expect.poll(() => p.lights).toBe(!lights);
    await page.waitForTimeout(3000); // Let the software renderer finish the changed model.
    await page.screenshot({ path: 'test-results/personal-controls-walking.png' });
    p.fuel = 0;
    await expect(fuel).toHaveCount(0);
    // Restore the parked tank and return through the player's inventory controls.
    p.fuel = 32;
    await page.keyboard.press('i');
    await page.getByRole('dialog').locator('[data-do="tractor"]').click();
    await page.keyboard.press('Escape');
    await expect.poll(() => p.vehicle).toBe(0);
    await expect(fuel).toContainText('50%');
    await expect(engine).toBeVisible();
    // Isolated rescue fixture: the raft has no motor even when a stored tank exists.
    Object.assign(p, { vehicle: 29, x: 0, z: 220, y: 0, fuel: 32, engine: false });
    await expect(page.locator('#driving')).toContainText('ROWING');
    await expect(fuel).toHaveCount(0);
    await expect(engine).toBeHidden();
    await expect(flashlight).toBeHidden();
    await expect(page.locator('#driving')).not.toContainText(/ENGINE ON|ENGINE OFF/);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/personal-controls-lifeboat.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-do="mobile-actions"]').click();
    await expect(page.getByRole('dialog').locator('[data-do="engine"]')).toBeHidden();
    await expect(page.getByRole('dialog').locator('[data-do="lights"]')).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
