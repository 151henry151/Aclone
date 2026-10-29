// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { waitForWorld } from './fixtures/ready';
import { defaultCreator } from '../../src/shared/creator';
import { ensurePastures } from '../../src/shared/pastures';
test('world owner saves a custom vehicle and expands a working livestock pasture through the game UI', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-vehicle-editor-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('World builder');
    const w = createWorld('editor', 'Editor', account.id),
      p = addPlayer(w, account.id, account.name);
    w.creator = defaultCreator();
    w.creator.roads = false;
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const barn = makeBuilding('pasture-barn', 'dairy', 0, 0);
    barn.owner = p.id;
    barn.stock = { cows: 4, feed: 100, water: 100 };
    w.buildings = [barn];
    ensurePastures(w);
    p.cash = 1000000;
    p.x = 0;
    p.z = 14;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, id: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    let form = page.locator('[data-vehicle-editor]');
    await form.locator('[name="slot"]').selectOption('8');
    await form.locator('[name="name"]').fill('Valley rover');
    await form.getByText('Performance, fuel and economy', { exact: true }).click();
    await form.locator('[name="speed"]').fill('18');
    await form.locator('[name="tank"]').fill('120');
    await form.locator('[name="capacity"]').fill('240');
    await form.getByText('Cockpit and instruments', { exact: true }).click();
    await form.locator('[name="customCockpit"]').selectOption('true');
    await form.locator('[name="eye_y"]').fill('2.3');
    await form.getByRole('button', { name: 'Save vehicle configuration' }).click();
    await expect.poll(() => w.vehicleTuning?.[8]?.name).toBe('Valley rover');
    expect(w.vehicleTuning![8].tank).toBe(120);
    await page.screenshot({ path: 'test-results/vehicle-editor.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(page.getByRole('button', { name: /Buy adjoining pasture/ })).toBeVisible();
    await page.getByRole('button', { name: /Buy adjoining pasture/ }).click();
    await expect.poll(() => barn.pasture?.parcels).toBe(2);
    await expect(page.getByText(/capacity 8 cows/)).toBeVisible();
    await page.screenshot({ path: 'test-results/pasture-management.png' });
    await page.keyboard.press('Escape');
    Object.assign(p, { vehicle: 8, fleet: [0, 5, 8], fuelVehicle: 8, fuel: 100 });
    await page.waitForTimeout(1500);
    await page.keyboard.press('c');
    await page.screenshot({ path: 'test-results/custom-vehicle-cockpit.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
