// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { ensurePasture } from '../../src/shared/pastures';
import { pastureParcelSize } from '../../src/shared/pasture-land';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('pasture size persists governs new land and keeps existing fences after rule edits', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-pasture-size-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Builder'),
      initial = createWorld('construction-rules', 'Construction', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    initial.zones = [];
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      parishOrders: false,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    initial.buildings = [];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 80,
      z: 93,
      y: 0,
      heading: Math.PI,
      vehicle: 5,
      engine: false,
      cash: 1000000,
      inventory: {},
      fuel: 64,
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
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Construction rules', exact: true }),
      size = group.locator('[name="pastureParcelSize"]'),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click(),
      dialog = page.getByRole('dialog');
    await edit();
    await size.fill('20');
    await apply();
    await expect.poll(() => w().settings.pastureParcelSize).toBe(20);
    await close();
    await edit();
    await expect(size).toHaveValue('20');
    await size.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pasture-size-rules.png' });
    await close();
    // Seed completed local barns after choosing the rule, then use ordinary pasture claiming.
    const barn = makeBuilding('barn', 'dairy', 80, 80);
    Object.assign(barn, {
      owner: account.id,
      rotation: 0,
      stock: { cows: 2, feed: 10, water: 10 },
      investment: 100000,
    });
    w().buildings = [barn];
    ensurePasture(w(), barn);
    expect(pastureParcelSize(barn.pasture!)).toBe(20);
    const empty = makeBuilding('empty', 'dairy', -200, -200);
    Object.assign(empty, { owner: account.id, rotation: 0, stock: {} });
    w().buildings.push(empty);
    w().zones.push({ id: 'blocked', kind: 'noBuild', x: -200, z: -200, radius: 100 });
    ensurePasture(w(), empty);
    expect(empty.pasture).toBeUndefined();
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target button').click();
    await expect(dialog).toContainText('1 parcels · 400 m²');
    const buy = dialog.getByRole('button', { name: /Buy adjoining pasture · 400 m²/ });
    await expect(buy).toBeVisible();
    await buy.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pasture-size-offer.png' });
    const before = p().cash;
    await buy.click();
    await expect.poll(() => w().buildings[0].pasture?.parcels).toBe(2);
    expect(p().cash).toBe(before - 25000);
    await expect(dialog).toContainText('2 parcels · 800 m²');
    await dialog
      .getByRole('heading', { name: 'Grazing pasture', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pasture-size-expanded.png' });
    await close();
    const original = JSON.stringify(w().buildings[0].pasture);
    await edit();
    await size.fill('8');
    await apply();
    await expect.poll(() => w().settings.pastureParcelSize).toBe(8);
    expect(JSON.stringify(w().buildings[0].pasture)).toBe(original);
    await size.fill('7');
    await apply();
    await expect(size).toBeFocused();
    expect(await size.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await size.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pasture-size-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(size).toHaveValue('8');
    await close();
    await page.locator('#target button').click();
    await expect(dialog).toContainText('2 parcels · 800 m²');
    await close();
    Object.assign(p(), { x: -200, z: -187, heading: Math.PI });
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target button').click();
    await expect(dialog).toContainText('No clear grazing area available near this barn');
    await expect(dialog.getByRole('button', { name: /Buy adjoining pasture/ })).toHaveCount(0);
    await dialog
      .getByRole('heading', { name: 'Grazing pasture', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/pasture-size-empty.png' });
    await close();
    Object.assign(p(), { x: 114, z: 110, heading: Math.PI });
    await page.reload();
    await waitForWorld(page);
    await page.screenshot({ path: 'test-results/pasture-size-fences.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
