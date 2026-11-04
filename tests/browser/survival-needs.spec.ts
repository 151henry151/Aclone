// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { catalogueSchema } from '../../src/shared/world-catalogue';
import { waitForWorld } from './fixtures/ready';

test('owners tune survival rules and see their limits, meals and empty-pantry damage', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-needs-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Needs owner');
    const initial = createWorld('needs-ui', 'Survival needs', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
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
    initial.catalogue = catalogueSchema.parse({
      items: { 'custom:meal': { name: 'Test meal', weight: 1, price: 1, food: 1000 } },
    });
    const home = makeBuilding('test-home', 'home', 0, 0);
    home.owner = account.id;
    home.name = 'Test home';
    home.stock = { water: 1 };
    initial.buildings = [home];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      vehicle: 0,
      engine: false,
      health: 20000,
      hunger: 10000,
      thirst: 10000,
      home: home.id,
      inventory: { 'custom:meal': 2 },
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const p = () => w().players[account.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'needs-ui');
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
    const group = page.getByRole('group', { name: 'Survival and needs', exact: true });
    const values = {
      needsAutoFeedThreshold: 12000,
      needsDamageThreshold: 20000,
      baseMaximumHealth: 40000,
      nutritionAdjustmentLimit: 800,
      repeatServingFrom: 2,
      repeatServingMultiplier: 0.25,
      energyRegeneration: 0,
    };
    for (const [key, value] of Object.entries(values))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.baseMaximumHealth).toBe(40000);
    await page.keyboard.press('Escape');
    await edit();
    for (const [key, value] of Object.entries(values))
      await expect(group.locator(`[name="${key}"]`)).toHaveValue(String(value));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/survival-needs-rules.png' });
    await group.locator('[name="needsAutoFeedThreshold"]').fill('21000');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Automatic meal threshold must be below');
    expect(w().settings.needsAutoFeedThreshold).toBe(12000);
    await page.keyboard.press('Escape');
    const meter = (name: string) =>
      page
        .locator('#needs .need')
        .filter({ has: page.locator('label', { hasText: new RegExp(`^${name}$`) }) });
    for (const name of ['Health', 'Hunger', 'Thirst', 'Wellbeing'])
      await expect(meter(name).locator('small')).toHaveText('50%');
    await page.keyboard.press('F6');
    await page.getByRole('button', { name: 'Residents', exact: true }).click();
    const card = page.locator('.caretaker-detail');
    await expect(card.locator('.hunger')).toHaveAttribute('style', 'width:50%');
    await expect(card.locator('.thirst')).toHaveAttribute('style', 'width:50%');
    await page.screenshot({ path: 'test-results/survival-needs-caretaker.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await page.getByRole('dialog').locator('[data-do="use"][data-id="custom:meal"]').click();
    await expect.poll(() => p().hunger).toBe(9000);
    await page.getByRole('dialog').locator('[data-do="use"][data-id="custom:meal"]').click();
    await expect.poll(() => p().hunger).toBe(8750);
    await page.keyboard.press('Escape');
    p().thirst = 12000;
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Go home', exact: true }).click();
    await expect.poll(() => p().atHome).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => w().buildings[0].stock.water).toBe(0);
    expect(p().thirst).toBeLessThan(12000);
    p().thirst = 20000;
    const health = p().health;
    await expect.poll(() => p().health).toBeLessThan(health - 6);
    await expect(meter('Thirst').locator('small')).toHaveText('100%');
    await page.screenshot({ path: 'test-results/survival-needs-empty-pantry.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
