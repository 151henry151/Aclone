// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, advance } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { butcherRamp } from '../../src/shared/butcher';
import { waitForWorld } from './fixtures/ready';

test('turkey flock, wagon, butcher and restaurant-to-home meals work through real controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(12000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-meat-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Pasture cook');
  const w = createWorld('meat-browser', 'Pasture to plate', account.id);
  w.script = '';
  w.zones = [];
  w.towns = [];
  w.roads = [];
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  w.creator = creatorSchema.parse({ roads: false, weather: 'clear' });
  Object.assign(w.settings, {
    mapSize: 500,
    seaLevel: -2,
    tidalRange: 0,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    parishOrders: false,
    slaughterSeconds: 2,
    turkeyBreedingSeconds: 2,
    homeCookingSeconds: 2,
    activeWork: false,
  });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 100,
    z: 108,
    y: 20,
    vehicle: 5,
    cash: 10000000,
    skills: ['livestock farmer', 'butcher', 'cook'],
    inventory: {},
  });
  const farm = makeBuilding('farm', 'turkeyFarm', 100, 100);
  Object.assign(farm, {
    owner: p.id,
    investment: 1000000,
    stock: { turkeys: 3, poults: 1, feed: 100, water: 100 },
    pasture: { x: 20, z: 0, parcels: 2 },
    young: [{ item: 'poults', count: 1, born: 0, grownDays: 2 }],
  });
  const keeper = addPlayer(w, 'turkey-keeper', 'Turkey keeper');
  Object.assign(keeper, { skills: ['livestock farmer'], job: farm.id, activeUntil: 1000000 });
  farm.employees = [keeper.id];
  const butcher = makeBuilding('butcher', 'butcher', 200, 100);
  Object.assign(butcher, { owner: p.id, investment: 1000000, architecture: 'model-1', stock: {} });
  const worker = addPlayer(w, 'butcher-worker', 'Qualified butcher');
  Object.assign(worker, { skills: ['butcher'], job: butcher.id, activeUntil: 1000000 });
  butcher.employees = [worker.id];
  const home = makeBuilding('home', 'home', 100, 170);
  Object.assign(home, { owner: p.id, stock: { potatoes: 2, water: 1 } });
  const kitchen = makeBuilding('kitchen', 'kitchen', 200, 170);
  kitchen.owner = p.id;
  kitchen.investment = 100000;
  kitchen.stock = { turkeyMeat: 1, potatoes: 2, water: 1 };
  const cook = addPlayer(w, 'restaurant-cook', 'Restaurant cook');
  Object.assign(cook, { skills: ['cook'], job: kitchen.id, activeUntil: 1000000 });
  const secondCook = addPlayer(w, 'restaurant-cook-2', 'Second restaurant cook');
  Object.assign(secondCook, { skills: ['cook'], job: kitchen.id, activeUntil: 1000000 });
  kitchen.employees = [cook.id, secondCook.id];
  w.buildings = [farm, butcher, home, kitchen];
  w.trailers = {
    wagon: { id: 'wagon', owner: p.id, kind: 'livestock', x: 100, z: 109, heading: 0, cargo: {} },
  };
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!,
    me = () => current().players[p.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const port = await app.listen();
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'normal');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('e');
    await expect(page.locator('[data-livestock-panel]')).toContainText('3 turkeys');
    await expect(page.locator('[data-livestock-panel]')).toContainText('1 poults');
    await page.getByRole('button', { name: /Arrange breeding/ }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === farm.id)!.breedingEnd ?? 0)
      .toBeGreaterThan(current().time);
    // Births settle at the normal care/production boundary, not on every render tick.
    advance(current(), 600);
    await expect
      .poll(() => current().buildings.find((b) => b.id === farm.id)!.stock.poults)
      .toBe(2);
    await page.screenshot({ path: testInfo.outputPath('turkey-farm-panel.png') });
    const openTrailers = async () => {
      const list = page.locator('[data-fleet-disclosure="owned-trailers"]');
      if ((await list.getAttribute('open')) === null) await list.locator('summary').click();
    };
    const transfer = (operation: string) =>
      page.locator('form[data-action="trailer"]').filter({
        has: page.locator(`input[name="operation"][value="${operation}"]`),
      });
    await openTrailers();
    for (const item of ['poults', 'turkeys']) {
      await transfer('load').locator('select[name="item"]').selectOption(item);
      await transfer('load').getByRole('button', { name: 'Load', exact: true }).click();
      await expect.poll(() => current().trailers!.wagon.cargo[item]).toBe(1);
    }
    const visit = async (id: string) => {
      await page.keyboard.press('Escape');
      const b = current().buildings.find((b) => b.id === id)!;
      const spot = b.kind === 'butcher' ? butcherRamp(b) : { x: b.x, z: b.z + 8 };
      Object.assign(me(), spot, { y: 20, speed: 0, atHome: false });
      Object.assign(current().trailers!.wagon, spot);
      current().revision++;
      await page.waitForTimeout(1200);
      await page.keyboard.press('e');
    };
    await visit('butcher');
    const service = page.locator('[data-butcher-panel]');
    await service
      .locator('article')
      .filter({ hasText: 'Turkey poults' })
      .getByRole('button', { name: 'Check young animal eligibility' })
      .click();
    await expect(page.locator('#toast')).toContainText('6.0 days to maturity');
    const cash = me().cash;
    await service.getByRole('button', { name: 'Slaughter Turkeys', exact: true }).click();
    await expect.poll(() => current().trailers!.wagon.cargo.turkeyMeat ?? 0).toBe(3);
    expect(me().cash).toBe(cash - 2970);
    expect(current().trailers!.wagon.cargo.poults).toBe(1);
    await visit('kitchen');
    const menu = page.locator('[data-meat-menu] select');
    for (const id of ['turkeyDinner', 'turkeyPie', 'turkeySoup'])
      await expect(menu.locator(`option[value="${id}"]`)).toHaveCount(1);
    await menu.selectOption('turkeyDinner');
    await page.getByRole('button', { name: 'Set meat menu', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === kitchen.id)!.recipe)
      .toBe('meat_turkeyDinner');
    advance(current(), 600);
    await expect
      .poll(() => current().buildings.find((b) => b.id === kitchen.id)!.stock.turkeyDinner ?? 0)
      .toBe(4);
    await expect(page.getByText(/Stockroom:.*4 Roast turkey dinner/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('turkey-restaurant-menu.png') });
    await visit('home');
    await openTrailers();
    await transfer('unload').locator('select[name="item"]').selectOption('turkeyMeat');
    await transfer('unload').getByRole('button', { name: 'Unload', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === home.id)!.stock.turkeyMeat)
      .toBe(1);
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => me().atHome).toBe(true);
    await page.keyboard.press('e');
    const cooking = page.locator('[data-home-cooking]');
    await expect(cooking).toContainText('Ingredients ready');
    await cooking.getByRole('button', { name: 'Cook Roast turkey dinner', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === home.id)!.stock.turkeyDinner ?? 0)
      .toBe(1);
    me().hunger = 60000;
    await expect.poll(() => me().hunger).toBeLessThan(60000);
    await expect
      .poll(() => current().buildings.find((b) => b.id === home.id)!.stock.turkeyDinner ?? 0)
      .toBe(0);
    await page.keyboard.press('Escape');
    // Return to the flock for a real in-world image, after the complete food journey.
    Object.assign(me(), { atHome: false, x: 120, z: 111, y: 20, heading: Math.PI, speed: 0 });
    delete me().inside;
    current().revision++;
    await page.waitForTimeout(1500);
    await page.keyboard.press('c');
    await page.keyboard.press('h');
    await page.screenshot({ path: testInfo.outputPath('turkey-pasture.png') });
    for (const name of ['turkey-farm-panel', 'turkey-restaurant-menu', 'turkey-pasture'])
      await testInfo.attach(name, {
        path: testInfo.outputPath(`${name}.png`),
        contentType: 'image/png',
      });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
