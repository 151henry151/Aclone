// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { enterpriseChoices } from '../../src/server/npc/enterprise';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('breeding budgets persist, change eligibility and refuse invalid values', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-breeding-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('breeding-rules', 'Breeding rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 500,
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
    const shop = makeBuilding('dairy', 'dairy', 50, 0);
    Object.assign(shop, {
      owner: account.id,
      wage: 0,
      investment: 10000,
      pasture: { x: 20, z: 0, parcels: 1 },
      stock: { cows: 2, feed: 6, water: 7 },
      buy: { flour: 100 },
      sell: {},
    });
    initial.buildings = [shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 20000,
      skills: ['livestock farmer'],
      fuel: 100,
      inventory: {},
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
    const breeding = () =>
      enterpriseChoices(w(), p()).filter((c) => c.description.startsWith('Breed a replacement'));
    expect(breeding()).toEqual([]);
    const group = page.getByRole('group', {
      name: 'Resident business budgets',
      exact: true,
    });
    await edit();
    const patch = {
      npcBreedingCashThreshold: 3000,
      npcBreedingFeedReserve: 6,
      npcBreedingWaterReserve: 7,
      npcBreedingSpareAnimals: 1,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcBreedingSpareAnimals).toBe(1);
    expect(breeding()).toHaveLength(1);
    expect(w().buildings[0].breedingEnd).toBeUndefined();
    expect(p().cash).toBe(20000);
    expect(w().buildings[0].investment).toBe(10000);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcBreedingSpareAnimals"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/breeding-budget-rules.png' });
    await group.locator('[name="npcBreedingSpareAnimals"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.npcBreedingSpareAnimals).toBe(0);
    expect(breeding()).toEqual([]);
    const invalid = group.locator('[name="npcBreedingSpareAnimals"]');
    await invalid.fill('-1');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '0',
    );
    await page.screenshot({ path: 'test-results/breeding-budget-invalid.png' });
    expect(w().settings.npcBreedingSpareAnimals).toBe(0);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcBreedingSpareAnimals"]')).toHaveValue('0');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
