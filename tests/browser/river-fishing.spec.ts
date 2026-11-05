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
test('river rod fishing waits at local height and refuses a dry bank', async ({ page }) => {
  // Three real river-terrain startups take about 35 seconds each on the test GPU.
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
        b.rotation = Math.atan2(nx, nz);
        if (!constructionSiteReason(initial, b)) {
          dock = b;
          break outer;
        }
      }
    expect(dock).toBeDefined();
    initial.buildings = [dock!];
    const site = riverDockSite(initial, dock!)!,
      skipper = addPlayer(initial, account.id, account.name);
    Object.assign(skipper, {
      vehicle: 3,
      fleet: [0, 5, 3],
      ...site.berth,
      y: site.level,
      heading: site.heading,
      speed: 0,
      engine: false,
      fuelVehicle: 3,
      fuel: 23,
      inventory: {},
    });
    skipper.fuel = 0;
    skipper.inventory = { tackle: 1 };
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
    const pos = { x: p().x, z: p().z, y: p().y };
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cast a line', exact: true })
      .click();
    await expect(page.locator('#fishing-status')).toHaveText('Waiting for a bite…');
    expect({ x: p().x, z: p().z, y: p().y }).toEqual(pos);
    expect(p().fishCatch).toBe('fish');
    await page.screenshot({ path: 'test-results/river-fishing-wait.png' });
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Leave current activity', exact: true }).click();
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    expect({ x: p().x, z: p().z, y: p().y }).toEqual(pos);
    Object.assign(p(), site.land, { y: terrainHeight(w(), site.land.x, site.land.z) });
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cast a line', exact: true })
      .click();
    await expect(page.locator('#toast')).toContainText('Take the boat into water before fishing');
    expect(p().game).not.toBe('fishing');
    expect(p().inventory).toEqual({ tackle: 1 });
    await page.screenshot({ path: 'test-results/river-fishing-refused.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
