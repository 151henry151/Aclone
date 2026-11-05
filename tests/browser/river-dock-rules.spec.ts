// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { riverBanks } from '../../src/shared/inland-water';
import { riverDockSite } from '../../src/shared/river-dock';
import { constructionSiteReason } from '../../src/shared/construction-site';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('river dock rules preserve moored boats while changing size and draft eligibility', async ({
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
    act(initial, skipper.id, { type: 'vehicle', slot: 5, building: dock!.id });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const saved = structuredClone(initial.mooredBoats);
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
      patch = { riverDockDraft: 1.2, riverDockMaxLength: 5, riverDockMaxBeam: 3.6 };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.riverDockMaxLength).toBe(5);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/river-rules-settings.png' });
    await close();
    const dialog = page.getByRole('dialog');
    await page.keyboard.press('i');
    await expect(dialog).toContainText(
      'River docks require 1.2 m depth and admit vessels up to 5 m long × 3.6 m beam',
    );
    await expect(
      dialog.getByRole('button', { name: 'Board your Canal boat', exact: true }),
    ).toBeHidden();
    expect(w().mooredBoats).toEqual(saved);
    await dialog.getByText(/River docks require 1.2/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/river-rules-size-refusal.png' });
    await close();
    await edit();
    await group.locator('[name="riverDockMaxLength"]').fill('14');
    await apply();
    await expect.poll(() => w().settings.riverDockMaxLength).toBe(14);
    await close();
    await page.keyboard.press('i');
    await dialog.getByRole('button', { name: 'Board your Canal boat', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(3);
    expect(p().fuel).toBe(23);
    if (await dialog.isVisible()) await close();
    await edit();
    await group.locator('[name="riverDockDraft"]').fill('20');
    await apply();
    await expect.poll(() => w().settings.riverDockDraft).toBe(20);
    await close();
    await page.keyboard.press('i');
    await expect(dialog).toContainText('Return to a boathouse berth');
    await expect(
      dialog.getByRole('button', { name: 'Disembark on foot', exact: true }),
    ).toBeHidden();
    expect(p().vehicle).toBe(3);
    expect(p().fuel).toBe(23);
    await dialog.getByText(/River docks require 20/).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/river-rules-draft-refusal.png' });
    await close();
    await edit();
    await group.locator('[name="riverDockDraft"]').fill('1.2');
    await apply();
    await expect.poll(() => w().settings.riverDockDraft).toBe(1.2);
    await close();
    await page.keyboard.press('i');
    await dialog.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => p().vehicle).toBe(5);
    expect(w().mooredBoats).toEqual(saved);
    if (await dialog.isVisible()) await close();
    await edit();
    const invalid = group.locator('[name="riverDockDraft"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/river-rules-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(invalid).toHaveValue('1.2');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
