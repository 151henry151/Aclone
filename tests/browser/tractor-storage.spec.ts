// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { migrateParkedVehicles, parkCurrentVehicle } from '../../src/shared/parked-vehicles';
import { tractorSlots } from '../../src/shared/tractors';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
for (const crowded of [true, false])
  test(
    crowded
      ? 'garage storage clears a crowded fleet, swaps tractors and keeps the current one outside'
      : 'a single-tractor owner sees purchase choices and an insufficient-cash explanation',
    async ({ page }) => {
      const dir = mkdtempSync(join(tmpdir(), 'aclone-tractor-storage-'));
      const app = await createApp({ dataDir: dir, port: 0, dev: true });
      const { account, token } = app.universe.register('Garage driver');
      const initial = createWorld('tractor-storage', 'Tractor garage', account.id);
      initial.script = '';
      initial.roads = [];
      initial.towns = [];
      initial.zones = [];
      initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
      initial.landscape = {
        heightmap: Array(1089).fill(0),
        paths: [],
        surfaces: [],
        barriers: [],
        scatter: [],
      };
      Object.assign(initial.settings, {
        seaLevel: -10,
        dayLength: 0,
        time: 43200,
        hungerRate: 0,
        thirstRate: 0,
        vehiclesPersist: true,
        arrivalAnimation: 'off',
        respawnX: 300,
        respawnZ: 300,
      });
      const p = addPlayer(initial, account.id, account.name);
      Object.assign(p, {
        x: 0,
        z: 13,
        y: 0,
        heading: Math.PI,
        vehicle: 24,
        lastTractor: 24,
        fleet: crowded ? [...tractorSlots, 5] : [24, 5],
        cash: 0,
        fuelVehicle: 24,
        fuel: 17,
        inventory: {},
        engine: false,
      });
      const garage = makeBuilding('garage', 'garage', 0, 0);
      garage.name = 'Parish Motor Works';
      initial.buildings = [garage];
      const record = parkCurrentVehicle(initial, p);
      for (const [index, slot] of tractorSlots.entries())
        if (crowded && slot !== 24)
          initial.parkedVehicles![p.id + ':' + slot] = {
            ...record,
            slot,
            x: (index + 1) * 5,
            fuel: 9,
          };
      p.vehicle = 5;
      p.x = -1.4;
      app.store.saveWorld(initial);
      const w = app.store.loadWorlds().find(({ world }) => world.id === initial.id)!.world;
      migrateParkedVehicles(w);
      app.worlds.set(w.id, w);
      const current = () => app.worlds.get(w.id)!.players[p.id];
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      mkdirSync('output/tractor-garage/browser', { recursive: true });
      try {
        const port = await app.listen();
        await page.route('**/src/client/main.ts', async (route) => {
          const response = await route.fetch();
          await route.fulfill({
            response,
            body: (await response.text()) + '\nglobalThis.__storageScene=scene;\n',
          });
        });
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
        const visible = () =>
          page.evaluate(
            () => (globalThis as any).__storageScene.parkedVehicles.group.children.length,
          );
        await expect.poll(visible).toBe(1);
        await page
          .locator('.quickbar')
          .getByRole('button', { name: 'Find tractor', exact: true })
          .click();
        await expect(page.locator('#waypoint-name')).toContainText('Orchard');
        if (crowded)
          await page.screenshot({ path: 'output/tractor-garage/browser/one_current_tractor.png' });
        if (crowded) await page.waitForTimeout(1500);
        await page.keyboard.press('m');
        await expect(page.locator('[data-parked-vehicle]')).toHaveCount(1);
        if (crowded) await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Board vehicle', exact: true }).click();
        await expect.poll(() => current().vehicle).toBe(24);
        await page.keyboard.press('Escape');
        await page
          .getByRole('button', { name: 'Trade & services outside', exact: true })
          .first()
          .click();
        const choice = page.getByLabel('Tractor model');
        await expect(choice).toBeVisible();
        await choice.selectOption('25');
        await expect(page.locator('#tractor-specs')).toContainText(
          'Only your current tractor stays outside',
        );
        if (!crowded) {
          await expect(
            page.getByRole('button', { name: 'Buy Swift Kestrel', exact: true }),
          ).toBeDisabled();
          await expect(page.locator('#tractor-specs')).toContainText('Not enough cash');
          expect(Object.keys(w.parkedVehicles ?? {}).length).toBe(0);
          expect(errors).toEqual([]);
          return;
        }
        await page.locator('#tractor-specs').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
        await page.getByRole('button', { name: 'Drive this tractor', exact: true }).click();
        await expect.poll(() => current().vehicle).toBe(25);
        expect(current().fuel).toBe(9);
        await expect(page.locator('#tractor-specs')).toContainText('Currently driving');
        await page.locator('#tractor-specs').scrollIntoViewIfNeeded();
        await page.screenshot({ path: 'output/tractor-garage/browser/switch_at_garage.png' });
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.keyboard.press('F4');
        await expect.poll(() => current().engine).toBe(true);
        await page.keyboard.down('w');
        try {
          await expect.poll(() => current().z).toBeGreaterThan(40);
        } finally {
          await page.keyboard.up('w');
        }
        await page.keyboard.press('F4');
        await expect.poll(() => Math.abs(current().speed)).toBeLessThan(0.5);
        await page.keyboard.press('i');
        await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
        await expect.poll(() => current().vehicle).toBe(5);
        await page.keyboard.press('Escape');
        await expect.poll(visible).toBe(1);
        expect(
          Object.values(w.parkedVehicles!)
            .filter((v) => !v.inside)
            .map((v) => v.slot),
        ).toEqual([25]);
        await page
          .locator('.quickbar')
          .getByRole('button', { name: 'Find tractor', exact: true })
          .click();
        await expect(page.locator('#waypoint-name')).toContainText('Swift');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'output/tractor-garage/browser/swift_parked_outside.png' });
        await page.keyboard.press('F10');
        await page.getByRole('button', { name: 'Rules', exact: true }).click();
        const group = page.getByRole('group', {
          name: 'Parked vehicles and arrivals',
          exact: true,
        });
        const toggle = group.locator('[name="garageStoresSpareTractors"]');
        await expect(toggle).toBeChecked();
        await toggle.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: 'output/tractor-garage/browser/storage_world_rule.png' });
        await toggle.uncheck();
        await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
        await expect.poll(() => w.settings.garageStoresSpareTractors).toBe(false);
        await toggle.check();
        await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
        await expect.poll(() => w.settings.garageStoresSpareTractors).toBe(true);
        await page.keyboard.press('Escape');
        expect(errors).toEqual([]);
      } finally {
        await page.close();
        await app.close();
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
