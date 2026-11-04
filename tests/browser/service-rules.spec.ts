// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { vehicleRecord } from '../../src/shared/vehicle-services';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('service rules control garage prices, parts failures and roadside readiness', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-service-rules-ui-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Mechanic');
    const initial = createWorld('service-ui', 'Service rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      fighting: true,
      weaponMode: 'ammo',
      requireMapItem: true,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      salesTax: 0,
      dayLength: 0,
      time: 43200,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const garage = makeBuilding('garage', 'garage', 0, 0);
    Object.assign(garage, { owner: 'neighbour', government: false, wage: 0, investment: 0 });
    initial.buildings = [garage];
    const player = addPlayer(initial, account.id, account.name),
      neighbour = addPlayer(initial, 'neighbour', 'Neighbour');
    for (const p of [player, neighbour]) {
      Object.assign(p, {
        x: 0,
        y: 0,
        z: 10,
        vehicle: 0,
        engine: false,
        cash: 100000,
        inventory: {},
        online: true,
      });
      vehicleRecord(initial, p).condition = 40;
    }
    player.skills = ['mechanic'];
    player.inventory = { tools: 1 };
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id],
      q = () => w().players.neighbour;
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'service-ui');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    await edit();
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    for (const [key, value] of Object.entries({
      vehicleServiceFee: 321,
      vehicleServiceSteel: 2,
      mapPrintPrice: 123,
      ammunitionRefitPrice: 456,
    }))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.vehicleServiceSteel).toBe(2);
    await page.keyboard.press('Escape');
    await edit();
    for (const [key, value] of Object.entries({
      vehicleServiceFee: 321,
      vehicleServiceSteel: 2,
      mapPrintPrice: 123,
      ammunitionRefitPrice: 456,
    }))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/service-rules.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('m');
    await expect(page.getByRole('dialog')).toContainText('Garages print one for 1.23d');
    await page.keyboard.press('Escape');
    await page.keyboard.press('F9');
    await page.getByRole('dialog').getByRole('button', { name: 'Activities', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('garage refits cost 4.56d');
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('2 carried Steel');
    await expect(dialog).toContainText('Labour 3.21d');
    await expect(dialog).toContainText('Printed Parish map: 1.23d');
    await page.getByRole('button', { name: 'Service vehicle', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('2 Steel');
    expect(p().cash).toBe(100000);
    expect(vehicleRecord(w(), p()).condition).toBe(40);
    p().inventory.steel = 2;
    await page.getByRole('button', { name: 'Service vehicle', exact: true }).click();
    await expect.poll(() => vehicleRecord(w(), p()).condition).toBe(65);
    expect(p().cash).toBe(99679);
    expect(p().inventory.steel).toBe(0);
    expect(w().buildings[0].investment).toBe(321);
    await page.getByRole('button', { name: 'Buy parish map', exact: true }).click();
    await expect.poll(() => p().inventory.parishMap).toBe(1);
    expect(p().cash).toBe(99556);
    await page.getByRole('button', { name: 'Refit ammunition · 4.56d', exact: true }).click();
    await expect.poll(() => p().cash).toBe(99100);
    await page
      .getByRole('heading', { name: 'Vehicle service', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/service-garage.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Players & roadside help', exact: true }).click();
    await page.locator('#modal-host [data-do=player]').click();
    const repair = page.locator('[data-do=repairVehicle]');
    await expect(repair).toBeDisabled();
    await expect(page.locator('#repair-status')).toContainText('2 Steel');
    p().inventory.steel = 2;
    await expect(repair).toBeEnabled();
    await expect(page.locator('#repair-status')).toContainText('Ready to use 2 Steel');
    await repair.click();
    await expect.poll(() => vehicleRecord(w(), q()).condition).toBe(65);
    await expect(repair).toBeDisabled();
    expect(p().inventory.steel).toBe(0);
    expect(p().inventory.tools).toBe(1);
    await repair.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/service-roadside.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
