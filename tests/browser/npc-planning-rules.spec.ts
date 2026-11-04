// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { ownerLivingDraw } from '../../src/server/npc/business-policy';
import { offlineReadiness } from '../../src/server/npc/homecoming';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('strategic horizon and zero pantry buffer save and reject an invalid horizon', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-planning-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Planning owner'),
      initial = createWorld('planning-rules', 'Planning rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 1,
      thirstRate: 2,
      homeNeedsMultiplier: 1,
      npcBudgetFuelThreshold: 0,
      dayLength: 0,
      time: 43200,
      parishOrders: false,
    });
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const shop = makeBuilding('supplies', 'market', 50, 50),
      home = makeBuilding('home', 'home', 30, 0),
      business = makeBuilding('business', 'market', 60, 0);
    shop.sell = { bread: 100, water: 200 };
    shop.stock = { bread: 100, water: 100 };
    home.owner = business.owner = account.id;
    home.stock = business.stock = {};
    business.investment = 100000;
    initial.buildings = [shop, home, business];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, {
      x: 0,
      z: 0,
      y: 0,
      engine: false,
      home: home.id,
      hunger: 15000,
      thirst: 15000,
      fuel: 100,
      inventory: {},
      cash: 0,
      bank: 0,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id],
      draw = () =>
        ownerLivingDraw(
          w(),
          p(),
          w().buildings.find((b) => b.id === business.id)!,
        );
    expect(draw()).toBe(2400);
    expect(offlineReadiness(w(), p(), 7500).stocked).toBe(false);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'planning-rules');
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
      },
      close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      group = page.getByRole('group', { name: 'Resident household budget', exact: true }),
      horizon = group.locator('[name="npcStrategicSeconds"]'),
      buffer = group.locator('[name="npcPantryBufferSeconds"]');
    await edit();
    await horizon.fill('3600');
    await buffer.fill('0');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.npcStrategicSeconds).toBe(3600);
    expect(draw()).toBe(300);
    expect(offlineReadiness(w(), p(), 7500).stocked).toBe(true);
    expect(p().cash).toBe(0);
    expect(w().buildings.find((b) => b.id === business.id)!.investment).toBe(100000);
    await close();
    await edit();
    await expect(horizon).toHaveValue('3600');
    await expect(buffer).toHaveValue('0');
    await horizon.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-planning-rules.png' });
    await horizon.fill('59');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(horizon).toBeFocused();
    expect(await horizon.evaluate((el) => (el as HTMLInputElement).validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await horizon.evaluate((el) => (el as HTMLInputElement).validationMessage)).not.toBe('');
    expect(w().settings.npcStrategicSeconds).toBe(3600);
    expect(draw()).toBe(300);
    await page.screenshot({ path: 'test-results/resident-planning-refusal.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(horizon).toHaveValue('3600');
    await expect(buffer).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
