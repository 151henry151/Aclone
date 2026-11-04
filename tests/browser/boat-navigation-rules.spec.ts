// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('boat arrival rules persist refuse distant landing then permit an empty vessel to moor', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-navigation-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Skipper'),
      initial = createWorld('navigation', 'Boat navigation', account.id);
    initial.script = '';
    initial.buildings = [];
    initial.zones = [];
    initial.towns = [];
    initial.resources = {};
    initial.roads = [];
    Object.assign(initial.settings, {
      requireCaptainSkill: false,
      vehicleLicences: false,
      tidalRange: 0,
      oceanWaves: 0,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 32.6,
      z: 195,
      y: initial.settings.seaLevel,
      heading: 0,
      vehicle: 33,
      fleet: [0, 5, 33],
      fuelVehicle: 33,
      fuel: 24,
      engine: false,
      speed: 0,
      inventory: {},
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
    const group = page.getByRole('group', { name: 'Boat navigation', exact: true }),
      patch = {
        boatShoreImpactLoss: 3,
        boatHouseArrivalRadius: 12,
        boatLandingArrivalRadius: 4,
        boatLandingShoreRadius: 2,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.boatLandingArrivalRadius).toBe(4);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/boat-navigation-settings.png' });
    await close();
    await page.keyboard.press('i');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Shore impacts cost 3 condition points');
    await expect(dialog).toContainText('Return to a boathouse berth');
    await expect(
      dialog.getByRole('button', { name: 'Disembark on foot', exact: true }),
    ).toBeHidden();
    await dialog.getByText(/Arrival: hull within 12 m/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/boat-navigation-unavailable.png' });
    await close();
    await edit();
    await group.locator('[name="boatLandingArrivalRadius"]').fill('40');
    await apply();
    await expect.poll(() => w().settings.boatLandingArrivalRadius).toBe(40);
    await close();
    await page.keyboard.press('i');
    await dialog.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(5);
    expect(Object.values(w().mooredBoats ?? {}).some((b) => b.slot === 33)).toBe(true);
    expect(p().inventory).toEqual({});
    if (await dialog.isVisible()) await close();
    await page.keyboard.press('i');
    await expect(
      dialog.getByRole('button', { name: 'Board your Outboard motorboat', exact: true }),
    ).toBeVisible();
    await dialog.getByText('Boating', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/boat-navigation-moored.png' });
    await close();
    await edit();
    const invalid = group.locator('[name="boatLandingArrivalRadius"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/boat-navigation-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(invalid).toHaveValue('40');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
