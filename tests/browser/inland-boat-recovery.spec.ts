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
import { surfaceWaterLevel } from '../../src/shared/ocean';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';
test('river lifeboat launch, mooring and recovery preserve local elevation and cargo', async ({
  page,
}) => {
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
    skipper.inventory = { cod: 7 };
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
    const inventory = async () => {
      if (await page.getByRole('dialog').isVisible())
        await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.keyboard.press('i');
    };
    const shot = async (name: string, text: string) => {
      await expect(async () => {
        await page.getByText(text, { exact: true }).scrollIntoViewIfNeeded();
      }).toPass({ timeout: 10000 });
      await page.screenshot({ path: `test-results/river-recovery-${name}.png` });
    };
    await inventory();
    await page.getByRole('button', { name: 'Launch emergency lifeboat', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(29);
    expect(p().y).toBeCloseTo(surfaceWaterLevel(w(), p().x, p().z), 5);
    expect(w().boatRescues![account.id].cargo).toEqual({ cod: 7 });
    const stranded = structuredClone(w().boatRescues![account.id].boat);
    await inventory();
    await shot('afloat', 'Reboard your stranded boat');
    await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(5);
    expect(w().boatRescues![account.id].dinghy.moored).toBe(true);
    await page.reload();
    await waitForWorld(page);
    await inventory();
    await shot('moored', 'Board your moored lifeboat');
    await page.getByRole('button', { name: 'Board your moored lifeboat', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(29);
    expect(p().y).toBeCloseTo(site.level, 5);
    expect(w().boatRescues![account.id].boat).toEqual(stranded);
    await inventory();
    await page.getByRole('button', { name: 'Reboard your stranded boat', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(3);
    expect(p().y).toBeCloseTo(site.level, 5);
    expect(p().inventory).toEqual({ cod: 7 });
    expect(p().fuel).toBe(0);
    expect(w().boatRescues![account.id]).toBeUndefined();
    await inventory();
    await shot('recovered', 'Launch emergency lifeboat');
    // A stranded hull on the dry bank must still refuse a launch without losing cargo.
    Object.assign(p(), site.land, { y: terrainHeight(w(), site.land.x, site.land.z) });
    await inventory();
    await page.getByRole('button', { name: 'Launch emergency lifeboat', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Launch the lifeboat on water');
    expect(w().boatRescues![account.id]).toBeUndefined();
    expect(p().inventory).toEqual({ cod: 7 });
    await shot('refused', 'Launch emergency lifeboat');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
