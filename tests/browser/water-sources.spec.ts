// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { prepareWaterSources } from '../../src/shared/springs';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('hike to a spring, drink, build a pump, and author sources and rules through the real UI', async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  mkdirSync('output/water-sources', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-springs-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Spring explorer');
  const w = createWorld('spring-browser', 'Fresh water country', account.id);
  w.script = '';
  w.buildings = [];
  w.zones = [];
  w.towns = [];
  w.roads = [];
  Object.assign(w.settings, {
    mapSize: 500,
    seaLevel: -2,
    tidalRange: 0,
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    parishOrders: false,
  });
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(30),
  };
  w.springs = [{ id: 'spring-hike', x: 100, z: 100, flow: 0.8 }];
  prepareWaterSources(w);
  w.creator = creatorSchema.parse({ roads: false, weather: 'clear' });
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, {
    x: 100,
    z: 102,
    y: 30,
    vehicle: 5,
    cash: 10000000,
    thirst: 30000,
    inventory: {},
  });
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
  const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const drink = page.getByRole('button', { name: 'Drink from the spring', exact: true });
    await expect(drink).toBeEnabled();
    await page.getByRole('button', { name: 'Return to tractor', exact: true }).click();
    await expect.poll(() => me().vehicle).not.toBe(5);
    await page.keyboard.press('i');
    await expect(page.locator('[data-spring-panel]')).toContainText('Stop on foot');
    await expect(drink).toBeDisabled();
    await page.getByRole('button', { name: 'Switch to walking', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(5);
    await page.keyboard.press('i');
    await expect(drink).toBeEnabled();
    await drink.click();
    await expect.poll(() => me().thirst).toBeLessThan(30000);
    await expect(drink).toBeDisabled();
    await expect(page.locator('[data-spring-panel]')).toContainText(/seconds/);
    expect(me().inventory).toEqual({});
    await page.screenshot({ path: 'output/water-sources/drinking-ui.png' });
    await close();
    await page.keyboard.press('m');
    await expect(page.locator('.map-spring-dot')).toHaveCount(1);
    await expect(page.locator('.map-load-status')).toBeHidden();
    await page.screenshot({ path: 'output/water-sources/spring-map.png' });
    await close();
    await page.keyboard.press('h');
    await page.mouse.wheel(0, -700);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/water-sources/spring-in-world.png' });
    await page.keyboard.press('h');
    Object.assign(me(), { x: 101, z: 108, speed: 0 });
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByLabel('Building type', { exact: true }).selectOption('pumpHouse');
    await expect(page.locator('[data-build-estimate]')).toContainText('Site clear');
    await page.screenshot({ path: 'output/water-sources/pump-preview.png' });
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => current().buildings.length).toBe(1);
    expect(current().buildings[0].waterSource?.spring).toBe('spring-hike');
    expect(current().buildings[0].x).toBe(100);
    // Keep a completed local fixture for the visible production and reservation checks.
    delete current().buildings[0].construction;
    current().buildings[0].stock = { fuel: 3 };
    current().buildings[0].investment = 100000;
    await page.keyboard.press('Escape');
    Object.assign(me(), { x: 130, z: 108, speed: 0 });
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Place foundation', exact: true }),
    ).toBeDisabled();
    await expect(page.locator('[data-build-estimate]')).toContainText('fresh water');
    await close();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const rules = page.getByRole('group', { name: 'Springs and water production', exact: true });
    await rules.locator('[name="pumpWaterPerBatch"]').fill('24');
    await rules.locator('[name="desalinationIntakeDepth"]').fill('0.4');
    await rules.locator('[name="desalinationFreeboard"]').fill('0.5');
    await rules.locator('[name="desalinationIntakeMinReach"]').fill('7');
    await rules.locator('[name="desalinationIntakeMaxReach"]').fill('11');
    await rules.locator('[name="pumpGravityEnabled"]').check();
    await rules.locator('[name="springsEnabled"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.springsEnabled).toBe(false);
    expect(current().settings.pumpWaterPerBatch).toBe(24);
    expect(current().settings.desalinationIntakeDepth).toBe(0.4);
    expect(current().settings.desalinationFreeboard).toBe(0.5);
    expect(current().settings.desalinationIntakeMinReach).toBe(7);
    expect(current().settings.desalinationIntakeMaxReach).toBe(11);
    await close();
    await page.keyboard.press('i');
    await expect(page.locator('[data-spring-panel]')).toContainText('disabled');
    await close();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await page.locator('[name="springsEnabled"]').check();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.springsEnabled).toBe(true);
    await page.getByRole('button', { name: 'Springs', exact: true }).click();
    await expect(page.locator('#creator-spring-form')).toBeVisible();
    await page.getByRole('button', { name: 'Delete spring', exact: true }).click();
    await expect.poll(() => current().springs?.length).toBe(0);
    await expect(page.getByRole('dialog')).toContainText('No springs');
    await close();
    await page.keyboard.press('i');
    await expect(page.locator('[data-spring-panel]')).toContainText('No springs');
    await close();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Springs', exact: true }).click();
    const form = page.locator('#creator-spring-form');
    await form.locator('[name="id"]').fill('spring-restored');
    await form.locator('[name="x"]').fill('100');
    await form.locator('[name="z"]').fill('100');
    await form.locator('[name="flow"]').fill('1.2');
    await form.getByRole('button', { name: 'Save spring', exact: true }).click();
    await expect.poll(() => current().springs?.[0]?.id).toBe('spring-restored');
    await page.screenshot({ path: 'output/water-sources/spring-editor.png' });
    expect(current().buildings[0].waterSource?.spring).toBe('spring-hike');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { terrainHeight } from '../../src/shared/terrain';
import { riverBanks } from '../../src/shared/inland-water';
import { pumpHouseSite } from '../../src/shared/fresh-water';
import { constructionSiteReason } from '../../src/shared/construction-site';
import { makeBuilding } from '../../src/shared/simulation';
test('a surveyed northern spring quenches a hiker and river/coastal construction use different water', async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-northern-springs-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Northern water builder');
  const initial = createWorld('puddlewick', 'Puddlewick', 'server');
  expandPuddlewickIsland(initial);
  prepareWaterSources(initial);
  initial.id = 'northern-water-browser';
  initial.name = 'Northern water survey';
  initial.owner = account.id;
  initial.script = '';
  initial.buildings = [];
  initial.towns = [];
  initial.zones = [];
  initial.roads = [];
  Object.assign(initial.settings, {
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    parishOrders: false,
  });
  initial.creator = creatorSchema.parse({ roads: false, weather: 'clear' });
  const spring = initial.springs!.find((s) => !s.river && s.z < -1000)!;
  const p = addPlayer(initial, account.id, account.name);
  Object.assign(p, {
    x: spring.x,
    z: spring.z + 5,
    y: terrainHeight(initial, spring.x, spring.z + 5),
    heading: Math.PI,
    vehicle: 5,
    thirst: 30000,
    cash: 10000000,
    inventory: {},
  });
  const probe = makeBuilding('construction', 'pumpHouse', 0, 0);
  probe.architecture = 'model-1';
  let riverSite: ReturnType<typeof pumpHouseSite>;
  for (const river of initial.northernIsland!.rivers) {
    const banks = riverBanks(river.points);
    for (let i = 4; i < river.points.length - 4 && !riverSite; i += 2)
      for (const side of ['left', 'right'] as const) {
        const bank = banks[i][side],
          point = river.points[i],
          d = Math.hypot(bank.x - point.x, bank.z - point.z),
          nx = (bank.x - point.x) / d,
          nz = (bank.z - point.z) / d;
        Object.assign(probe, {
          x: bank.x + nx * 5,
          z: bank.z + nz * 5,
          rotation: Math.round(Math.atan2(nx, nz) / (Math.PI / 12)) * (Math.PI / 12),
        });
        const site = pumpHouseSite(initial, probe);
        if (site && !constructionSiteReason(initial, { ...probe, ...site })) {
          riverSite = site;
          break;
        }
      }
    if (riverSite) break;
  }
  expect(riverSite).toBeDefined();
  app.worlds.set(initial.id, initial);
  const w = () => app.worlds.get(initial.id)!,
    me = () => w().players[p.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
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
  const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    await expect(page.locator('[data-spring-panel]')).toContainText('within 3');
    await close();
    await page.keyboard.press('m');
    await expect(page.locator('.map-spring-dot').first()).toBeVisible();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(page.locator('.map-spring-dot').first()).toBeVisible();
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(page.locator('.map-spring-dot')).toHaveCount(0);
    await close();
    await page.keyboard.down('w');
    await expect.poll(() => Math.hypot(me().x - spring.x, me().z - spring.z)).toBeLessThan(2.8);
    await page.keyboard.up('w');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Drink from the spring', exact: true }).click();
    await expect.poll(() => me().thirst).toBeLessThan(30000);
    await close();
    Object.assign(me(), {
      ...riverSite,
      y: terrainHeight(w(), riverSite!.x, riverSite!.z),
      speed: 0,
    });
    w().revision++;
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByLabel('Building type', { exact: true }).selectOption('pumpHouse');
    const degrees = ((((riverSite!.rotation * 180) / Math.PI) % 360) + 360) % 360;
    await page.getByLabel('Building rotation', { exact: true }).fill(String(Math.round(degrees)));
    await expect(page.locator('[data-build-estimate]')).toContainText('Site clear');
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => w().buildings.length).toBe(1);
    expect(w().buildings[0].waterSource?.river).toBeTruthy();
    await page.keyboard.press('Escape');
    Object.assign(me(), { x: 0, z: 144, y: terrainHeight(w(), 0, 144), speed: 0 });
    w().revision++;
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.getByLabel('Building rotation', { exact: true }).fill('180');
    await expect(page.locator('[data-build-estimate]')).toContainText(
      'build a desalination plant on the coast',
    );
    await expect(
      page.getByRole('button', { name: 'Place foundation', exact: true }),
    ).toBeDisabled();
    await page.getByLabel('Building type', { exact: true }).selectOption('waterworks');
    await expect(page.locator('[data-build-estimate]')).toContainText('Site clear');
    await page.getByRole('button', { name: 'Place foundation', exact: true }).click();
    await expect.poll(() => w().buildings.length).toBe(2);
    expect(w().buildings[1].kind).toBe('waterworks');
    expect(w().buildings[1].legacyWaterIntake).toBeUndefined();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
