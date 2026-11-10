// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('inventory follows nearby actions and keeps trailers collapsed on desktop and phone', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/inventory-context', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-inventory-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Inventory pilot');
  const w = createWorld('inventory', 'Contextual inventory', account.id);
  Object.assign(w, {
    script: '',
    roads: [],
    towns: [],
    zones: [],
    terrain: [],
    buildings: [],
    airfield: undefined,
    spaceportSite: undefined,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
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
    dayLength: 0,
    time: 12 * 3600,
    hungerRate: 0,
    thirstRate: 0,
    vehicleMaintenance: false,
    springDrinkRange: 3,
    springDrinkCooldown: 20,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 0,
    z: 10,
    y: 0,
    heading: Math.PI,
    vehicle: 5,
    fleet: [0, 5],
    inventory: {},
    speed: 0,
    thirst: 30000,
  });
  w.springs = [{ id: 'test-spring', x: 0, z: 0, flow: 1 }];
  w.smallCraft = {};
  w.trailers = {};
  for (let i = 0; i < 10; i++)
    w.trailers['t' + i] = {
      id: 't' + i,
      owner: p.id,
      kind: 'dump',
      x: 200,
      z: 200,
      heading: 0,
      cargo: {},
    };
  app.worlds.set(w.id, w);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
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
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const modal = page.locator('#modal-host');
    const trailers = modal.locator('[data-fleet-disclosure="owned-trailers"]');
    await expect(modal.getByRole('heading', { name: 'Natural spring', exact: true })).toBeHidden();
    await expect(modal.getByRole('heading', { name: 'Portable canoes' })).toBeHidden();
    await expect(modal.getByRole('heading', { name: 'Boating', exact: true })).toBeHidden();
    await expect(modal.getByText('Discarding permanently', { exact: false })).toBeHidden();
    await expect(
      modal.getByRole('button', { name: 'Switch to walking', exact: true }),
    ).toBeHidden();
    await expect(modal.getByRole('button', { name: 'Toggle robocrow', exact: true })).toBeHidden();
    await expect(modal).toContainText("You're not carrying any items.");
    await expect(trailers.locator('summary')).toHaveText('Your trailers (10)');
    await expect(trailers).not.toHaveAttribute('open', '');
    await expect(trailers.locator('h4').first()).toBeHidden();
    await page.screenshot({ path: 'output/inventory-context/quiet-inventory.png' });
    await trailers.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(trailers.locator('h4').first()).toBeVisible();
    await modal.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.down('w');
    await expect.poll(() => p.z).toBeLessThan(2.5);
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.5);
    await page.keyboard.press('i');
    await expect(trailers).toHaveAttribute('open', '');
    await trailers.locator('summary').click();
    const drink = modal.getByRole('button', { name: 'Drink from the spring' });
    await expect(drink).toBeEnabled();
    await drink.click();
    await expect(drink).toBeDisabled();
    await expect(modal.locator('[data-spring-panel]')).toContainText(/Wait \d+ seconds/);
    await page.screenshot({ path: 'output/inventory-context/near-spring.png' });
    // Live snapshots while the panel stays open must add/remove relevant actions.
    p.z = 10;
    await expect(drink).toBeHidden();
    w.settings.springDrinkRange = 12;
    await expect(drink).toBeVisible();
    w.settings.springDrinkingEnabled = false;
    await expect(drink).toBeHidden();
    p.inventory.canoe = 1;
    await expect(modal.getByRole('button', { name: 'Lift inventory canoe' })).toBeVisible();
    delete p.inventory.canoe;
    w.smallCraft = {
      c: {
        id: 'c',
        kind: 'canoe',
        paint: 'red',
        owner: p.id,
        x: p.x,
        z: p.z,
        heading: 0,
        state: 'setDown',
      },
    };
    await expect(modal.getByRole('button', { name: 'Pick up canoe' })).toBeVisible();
    w.smallCraft!.c.x = 200;
    await expect(modal.getByRole('heading', { name: 'Portable canoes' })).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(trailers).not.toHaveAttribute('open', '');
    await trailers.locator('summary').click();
    await expect(trailers.locator('h4').first()).toBeVisible();
    await trailers.locator('summary').click();
    await page.screenshot({ path: 'output/inventory-context/mobile-inventory.png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    w.trailers = {};
    await modal.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('i');
    await expect(trailers).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
