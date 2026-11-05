// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { riverBanks } from '../../src/shared/inland-water';
import { riverDockSite } from '../../src/shared/river-dock';
import { constructionSiteReason } from '../../src/shared/construction-site';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';
for (const slot of [3, 33])
  test(`river dock construction and persistent mooring for vessel ${slot}`, async ({ page }) => {
    // Two real river-terrain startups take about 35 seconds each on the test GPU.
    // Keep the shared 60-second readiness assertions for every load.
    test.setTimeout(180000);
    page.setDefaultTimeout(15000);
    const dir = mkdtempSync(join(tmpdir(), 'aclone-river-rules-')),
      app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const { account, token } = app.universe.register('River skipper'),
        initial = createWorld('puddlewick', 'Puddlewick', 'server');
      initial.settings.mapSize = 18500;
      initial.terrainMapSize = 12500;
      initial.townLayout = 2;
      expandPuddlewickIsland(initial);
      initial.id = 'river-rules';
      initial.name = 'River dock rules';
      initial.owner = account.id;
      initial.script = '';
      initial.buildings = [];
      initial.zones = [];
      initial.towns = [];
      initial.roads = [];
      initial.resources = {};
      Object.assign(initial.settings, {
        requireCaptainSkill: false,
        vehicleLicences: false,
        hungerRate: 0,
        thirstRate: 0,
      });
      initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
      const river = initial.northernIsland!.rivers[0],
        banks = riverBanks(river.points);
      let dock: ReturnType<typeof makeBuilding> | undefined;
      outer: for (let i = Math.floor(river.points.length * 0.55); i < river.points.length - 3; i++)
        for (const side of ['left', 'right'] as const) {
          const pt = river.points[i],
            bank = banks[i][side],
            d = Math.hypot(bank.x - pt.x, bank.z - pt.z) || 1,
            nx = (bank.x - pt.x) / d,
            nz = (bank.z - pt.z) / d;
          const b = makeBuilding('river-dock', 'riverDock', bank.x + nx * 3.5, bank.z + nz * 3.5);
          b.rotation =
            (((Math.round((Math.atan2(nx, nz) * 180) / Math.PI / 15) * 15 + 360) % 360) * Math.PI) /
            180;
          if (!constructionSiteReason(initial, b)) {
            dock = b;
            break outer;
          }
        }
      expect(dock).toBeDefined();
      initial.buildings = [];
      const site = riverDockSite(initial, dock!)!,
        skipper = addPlayer(initial, account.id, account.name);
      Object.assign(skipper, {
        vehicle: 0,
        fleet: [0, 5, slot, 30],
        x: dock!.x,
        z: dock!.z,
        y: terrainHeight(initial, dock!.x, dock!.z),
        heading: site.heading,
        speed: 0,
        engine: false,
        fuelVehicle: 3,
        fuel: 23,
        inventory: {},
      });
      skipper.cash = 1000000;
      skipper.parkedFuel = { [slot]: 23 };
      skipper.fuelVehicle = 0;
      skipper.inventory = { logs: 30, gravel: 10 };
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
      const cash = p().cash;
      await page.locator('[data-do="construction"]:visible').click();
      await page.getByLabel('Building type', { exact: true }).selectOption('riverDock');
      const degrees = Math.round((dock!.rotation * 180) / Math.PI),
        wrong = (degrees + 180) % 360;
      for (let i = 0; i < wrong / 15; i++)
        await page.getByRole('button', { name: 'Rotate right' }).click();
      await expect(page.getByRole('button', { name: 'Place foundation' })).toBeDisabled();
      await expect(page.locator('[data-build-estimate]')).toContainText('1.2 m');
      await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/river-build-${slot}-refused.png` });
      for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Rotate right' }).click();
      await expect(page.getByLabel('Building rotation', { exact: true })).toHaveValue(
        String(degrees),
      );
      await expect(page.locator('[data-build-estimate]')).toContainText('30 Logs');
      await expect(page.locator('[data-build-estimate]')).toContainText('10 Gravel');
      await expect(page.locator('[data-build-estimate]')).toContainText('3s 0d');
      await expect(page.getByRole('button', { name: 'Place foundation' })).toBeEnabled();
      await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/river-build-${slot}-preview.png` });
      await page.getByRole('button', { name: 'Place foundation' }).click();
      await expect.poll(() => w().buildings.length).toBe(1);
      const b = w().buildings[0];
      expect(b.construction).toEqual({ logs: 30, gravel: 10 });
      expect(p().cash).toBe(cash - 30000);
      expect(b.rotation).toBeCloseTo(dock!.rotation, 8);
      await page.locator('#target').click();
      await page
        .getByRole('button', { name: 'Deliver construction materials', exact: true })
        .click();
      await expect.poll(() => w().buildings[0].construction).toBeUndefined();
      expect(p().inventory.logs ?? 0).toBe(0);
      expect(p().inventory.gravel ?? 0).toBe(0);
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      Object.assign(p(), site.land, {
        vehicle: 5,
        y: terrainHeight(w(), site.land.x, site.land.z),
      });
      await page.keyboard.press('i');
      const boatName = slot === 3 ? 'Canal boat' : 'Outboard motorboat';
      await page.getByRole('button', { name: `Board your ${boatName}`, exact: true }).click();
      await expect.poll(() => p().vehicle).toBe(slot);
      expect(p().fuel).toBe(23);
      expect(p().y).toBeCloseTo(site.level, 5);
      await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
      await expect.poll(() => p().vehicle).toBe(5);
      const mooring = structuredClone(w().mooredBoats);
      await page.reload();
      await waitForWorld(page);
      expect(w().mooredBoats).toEqual(mooring);
      await page.screenshot({ path: `test-results/river-build-${slot}-moored.png` });
      await page.keyboard.press('i');
      await expect(page.getByRole('button', { name: /Board your.*[Tt]rawl/ })).toHaveCount(0);
      await page.getByRole('button', { name: `Board your ${boatName}`, exact: true }).click();
      await expect.poll(() => p().vehicle).toBe(slot);
      expect(p().fuel).toBe(23);
      expect(p().y).toBeCloseTo(site.level, 5);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
