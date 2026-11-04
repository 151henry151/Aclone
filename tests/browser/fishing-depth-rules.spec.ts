// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('offshore fishing rules persist and control deployment refusal and empty hauling', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-waits-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Angler'),
      initial = createWorld('waits', 'Fishing waits', account.id);
    initial.script = '';
    initial.buildings = [];
    initial.towns = [];
    initial.roads = [];
    initial.zones = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: 0,
      hungerRate: 0,
      thirstRate: 0,
      fishingMode: 5,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(-20),
    };
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 80,
      z: 80,
      y: 0,
      vehicle: 30,
      fuelVehicle: 30,
      fuel: 100,
      boatThrottle: 0,
      engine: true,
      speed: 0,
      inventory: { tackle: 1 },
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
    const group = page.getByRole('group', { name: 'Fishing rules', exact: true });
    await edit();
    await group.locator('[name="fishingDeepDepth"]').fill('1000');
    await group.locator('[name="fishingShoreDistance"]').fill('60');
    await apply();
    await expect.poll(() => w().settings.fishingDeepDepth).toBe(1000);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="fishingDeepDepth"]')).toHaveValue('1000');
    await expect(group.locator('[name="fishingShoreDistance"]')).toHaveValue('60');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-depth-rules.png' });
    await close();
    const inventory = () => page.keyboard.press('i');
    const dialog = page.getByRole('dialog');
    await inventory();
    await expect(dialog).toContainText(
      'Deep fishing requires 1000 m depth and 60 m shore clearance',
    );
    await dialog.getByRole('button', { name: 'Deploy nets', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('not enough clear water');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('color', 'rgb(255, 241, 213)');
    expect(p().trawl?.deployed ?? false).toBe(false);
    await page.screenshot({ path: 'test-results/fishing-depth-refusal.png' });
    await close();
    await edit();
    await group.locator('[name="fishingDeepDepth"]').fill('8');
    await apply();
    await expect.poll(() => w().settings.fishingDeepDepth).toBe(8);
    await close();
    await inventory();
    await expect(dialog).toContainText('Deep fishing requires 8 m depth and 60 m shore clearance');
    await dialog.getByRole('button', { name: 'Deploy nets', exact: true }).click();
    await expect.poll(() => p().trawl?.deployed).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Stow nets', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/fishing-depth-deployed.png' });
    await dialog.getByRole('button', { name: 'Haul catch and stow nets', exact: true }).click();
    await expect.poll(() => p().trawl?.deployed).toBe(false);
    await expect(page.locator('#toast')).toContainText('Net hauled: no fish');
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    expect(p().inventory.cod ?? 0).toBe(0);
    await page.screenshot({ path: 'test-results/fishing-depth-empty.png' });
    await close();
    await edit();
    const invalid = group.locator('[name="fishingDeepDepth"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-depth-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(invalid).toHaveValue('8');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
