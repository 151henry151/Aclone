// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, advance } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { butcherRamp } from '../../src/shared/butcher';
import { waitForWorld } from './fixtures/ready';

test('raise livestock, use the butcher, choose a kitchen menu and cook at home through the player UI', async ({
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(12000);
  mkdirSync('output/livestock-meat', { recursive: true });
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
    inventory: { chickens: 1, chicks: 1 },
  });
  p.inventoryLife = { young: [{ item: 'chicks', count: 1, born: 0, grownDays: 2 }] };
  const farm = makeBuilding('farm', 'dairy', 100, 100);
  Object.assign(farm, {
    owner: p.id,
    investment: 1000000,
    stock: { cows: 2, calves: 2, feed: 100, water: 100 },
    pasture: { x: 20, z: 0, parcels: 2 },
    young: [{ item: 'calves', count: 2, born: 0, grownDays: 10 }],
  });
  const butcher = makeBuilding('butcher', 'butcher', 200, 100);
  Object.assign(butcher, { owner: p.id, investment: 1000000, architecture: 'model-1', stock: {} });
  const worker = addPlayer(w, 'butcher-worker', 'Qualified butcher');
  Object.assign(worker, { skills: ['butcher'], job: butcher.id, activeUntil: 1000000 });
  butcher.employees = [worker.id];
  const home = makeBuilding('home', 'home', 100, 170);
  Object.assign(home, { owner: p.id, stock: { beef: 1, potatoes: 2, water: 1 } });
  const kitchen = makeBuilding('kitchen', 'kitchen', 200, 170);
  kitchen.owner = p.id;
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
    await expect(page.getByRole('heading', { name: 'Young animals', exact: true })).toBeVisible({
      timeout: 7000,
    });
    await expect(page.locator('[data-livestock-panel]')).toContainText('2 calves');
    await page.getByRole('button', { name: 'Enable continuous breeding', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === farm.id)?.continuousBreeding)
      .toBe(true);
    await expect(
      page.getByRole('button', { name: 'Disable continuous breeding', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'output/livestock-meat/livestock-panel.png' });
    const load = page
      .locator('form[data-action="trailer"]')
      .filter({ has: page.locator('input[name="operation"][value="load"]') });
    await load.locator('select[name="item"]').selectOption('calves');
    await load.getByRole('button', { name: 'Load', exact: true }).click();
    await expect.poll(() => current().trailers!.wagon.cargo.calves).toBe(1);
    const visit = async (id: string) => {
      await page.keyboard.press('Escape');
      const b = current().buildings.find((b) => b.id === id)!;
      const spot = b.kind === 'butcher' ? butcherRamp(b) : { x: b.x, z: b.z + 8 };
      Object.assign(me(), spot, { y: 20, speed: 0, atHome: false });
      if (id === 'butcher' || id === 'farm') Object.assign(current().trailers!.wagon, spot);
      current().revision++;
      await page.waitForTimeout(1200);
      await page.keyboard.press('e');
    };
    await visit('butcher');
    const service = page.locator('[data-butcher-panel]');
    await expect(service).toContainText('Livestock wagon');
    const youngWagon = service.locator('article').filter({ hasText: 'Calves' });
    await youngWagon.getByRole('button', { name: 'Check young animal eligibility' }).click();
    await expect(page.locator('#toast')).toContainText('30.0 days to maturity');
    const chicken = service.getByRole('button', { name: 'Slaughter Chickens', exact: true });
    const cash = me().cash;
    await chicken.click();
    await expect.poll(() => me().inventory.poultry ?? 0).toBe(1);
    expect(me().inventory.chickens ?? 0).toBe(0);
    expect(me().cash).toBeLessThan(cash);
    await page.screenshot({ path: 'output/livestock-meat/butcher-service.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await page.getByRole('dialog').locator('[data-do="use"][data-id="poultry"]').click();
    await expect(page.locator('#toast')).toContainText('Raw meat must be cooked');
    await visit('kitchen');
    await page.locator('[data-meat-menu] select').selectOption('beefStew');
    await page.getByRole('button', { name: 'Set meat menu', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === 'kitchen')!.recipe)
      .toBe('meat_beefStew');
    await visit('home');
    await expect(page.locator('[data-home-cooking]')).toContainText('Go inside');
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => me().atHome).toBe(true);
    await page.keyboard.press('e');
    await expect(page.locator('[data-home-cooking]')).toContainText('Ingredients ready');
    await page.getByRole('button', { name: 'Cook Beef stew', exact: true }).click();
    await expect
      .poll(() => current().buildings.find((b) => b.id === 'home')!.stock.beefStew ?? 0)
      .toBe(1);
    await expect(page.locator('[data-home-cooking]')).toContainText('Missing ingredients');
    await page.screenshot({ path: 'output/livestock-meat/home-cooking.png' });
    // Automatic home feeding uses the cooked serving, not raw ingredients.
    me().hunger = 60000;
    advance(current(), 1);
    expect(current().buildings.find((b) => b.id === 'home')!.stock.beefStew ?? 0).toBe(0);
    expect(me().hunger).toBeLessThan(60000);
    const building = (id: string) => current().buildings.find((b) => b.id === id)!;
    await visit('farm');
    await load.locator('select[name="item"]').selectOption('cows');
    await load.getByRole('button', { name: 'Load', exact: true }).click();
    await expect.poll(() => current().trailers!.wagon.cargo.cows).toBe(1);
    await visit('butcher');
    const cow = service.getByRole('button', { name: 'Slaughter Cows', exact: true });
    me().cash = 0;
    await cow.click();
    await expect(page.locator('#toast')).toContainText('Not enough cash');
    me().cash = 10000000;
    current().settings.slaughterSeconds = 60;
    await cow.click();
    await expect(service.getByRole('button', { name: 'Cancel slaughter' })).toBeVisible();
    await service.getByRole('button', { name: 'Cancel slaughter' }).click();
    await expect.poll(() => me().task).toBeUndefined();
    expect(current().trailers!.wagon.cargo.cows).toBe(1);
    await cow.click();
    await expect.poll(() => me().task?.kind).toBe('slaughter');
    building('butcher').slaughterFees = { cows: 123 };
    advance(current(), 60);
    await expect.poll(() => me().task).toBeUndefined();
    expect(current().trailers!.wagon.cargo.cows).toBe(1);
    expect(current().messages.at(-1)!.text).toMatch(/cancelled.*changed/i);
    current().settings.slaughterSeconds = 2;
    await cow.click();
    await expect.poll(() => current().trailers!.wagon.cargo.beef ?? 0).toBe(12);
    expect(current().trailers!.wagon.cargo.cows ?? 0).toBe(0);
    const savedInventory = structuredClone(me().inventory),
      savedCargo = structuredClone(current().trailers!.wagon.cargo);
    me().inventory = {};
    current().trailers!.wagon.cargo = {};
    await expect(service).toContainText('No animals');
    current().settings.butchersEnabled = false;
    await expect(service).toContainText('Butchers are disabled');
    current().settings.butchersEnabled = true;
    me().inventory = savedInventory;
    current().trailers!.wagon.cargo = savedCargo;
    await visit('home');
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => me().atHome).toBe(true);
    await page.keyboard.press('e');
    const cook = page.locator('[data-home-cooking]');
    await expect(cook.getByRole('button', { name: 'Cook Beef stew', exact: true })).toBeDisabled();
    me().hunger = 0;
    me().thirst = 0;
    building('home').stock = {
      beef: 1,
      potatoes: 2,
      water: 1,
      beefStew: building('home').capacity,
    };
    await expect(cook).toContainText('The home pantry is full');
    current().settings.homeCookingEnabled = false;
    await expect(cook).toContainText('Home cooking is disabled');
    current().settings.homeCookingEnabled = true;
    current().settings.homeCookingSeconds = 60;
    building('home').stock.beefStew = 0;
    await cook.getByRole('button', { name: 'Cook Beef stew', exact: true }).click();
    await cook.getByRole('button', { name: 'Cancel cooking', exact: true }).click();
    await expect.poll(() => me().task).toBeUndefined();
    expect(building('home').stock.beef).toBe(1);
    await cook.getByRole('button', { name: 'Cook Beef stew', exact: true }).click();
    await expect.poll(() => me().task?.kind).toBe('homeCook');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'At home · Go outside', exact: true }).click();
    await expect.poll(() => me().atHome).toBe(false);
    expect(me().task).toBeUndefined();
    expect(building('home').stock.beef).toBe(1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('e');
    await expect(page.locator('[data-home-cooking]')).toContainText('Go inside');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('[data-home-cooking]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/livestock-meat/home-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const herdRules = page.getByRole('group', { name: 'Livestock life cycle', exact: true });
    const meatRules = page.getByRole('group', { name: 'Butcher and cooking', exact: true });
    await herdRules.locator('[name="calfMaturityDays"]').fill('30');
    await meatRules.locator('[name="beefYield"]').fill('15');
    await meatRules.locator('[name="rawMeatEdible"]').check();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.beefYield).toBe(15);
    expect(current().settings.calfMaturityDays).toBe(30);
    expect(current().settings.rawMeatEdible).toBe(true);
    await meatRules.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/livestock-meat/world-rules.png' });
    const invalid = herdRules.locator('[name="calfMaturityDays"]');
    await invalid.fill('0');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(current().settings.calfMaturityDays).toBe(30);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(herdRules.locator('[name="calfMaturityDays"]')).toHaveValue('30');
    await expect(meatRules.locator('[name="beefYield"]')).toHaveValue('15');
    await expect(meatRules.locator('[name="rawMeatEdible"]')).toBeChecked();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
