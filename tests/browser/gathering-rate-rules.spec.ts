// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { worldResources } from '../../src/shared/resources';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('gathering rates persist update the HUD and menu and complete ordinary timed loads', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-gathering-rates-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
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
      z: 80,
      y: 0,
      heading: 0,
      vehicle: 5,
      engine: false,
      cash: 1000000,
      inventory: {},
      fuel: 64,
    });
    const node = worldResources(initial).find((n) => n.item === 'dirt')!;
    Object.assign(player, { x: node.x, z: node.z, y: 0, vehicle: 5, inventory: { shovel: 1 } });
    initial.resources[node.id] = { amount: 2, updated: initial.time };
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
    const group = page.getByRole('group', { name: 'Gathering rules', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      gatheringBaseYield: 2,
      gatheringSkilledYield: 4,
      gatheringBaseSeconds: 3,
      gatheringSkilledSeconds: 5,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.gatheringBaseYield).toBe(2);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-rate-rules.png' });
    await close();
    await expect(page.locator('#resource-status')).toContainText('2 topsoil per load · 3 seconds');
    await page.locator('[data-do="resources"]:visible').click();
    await expect(page.getByRole('dialog')).toContainText(
      'School qualifications select this world’s skilled load and gathering time.',
    );
    const row = page
      .getByRole('dialog')
      .locator('article')
      .filter({ has: page.locator(`[data-do="gather"][data-id="${node.id}"]`) });
    await expect(row).toContainText('2 per load · 3 seconds');
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-rate-menu.png' });
    await close();
    await page.locator('#resource-gather').click();
    await expect.poll(() => p().task?.amount).toBe(2);
    await expect(page.locator('#task-name')).toContainText('Gathering 2');
    await expect.poll(() => p().inventory.dirt).toBe(2);
    await expect(page.locator('#resource-status')).toContainText('needs time to replenish');
    await expect(page.locator('#resource-gather')).toBeDisabled();
    expect(w().resources![node.id].amount).toBe(0);
    await page.screenshot({ path: 'test-results/gathering-rate-depleted.png' });
    p().skills.push('excavator');
    w().resources![node.id] = { amount: 30, updated: w().time };
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#resource-status')).toContainText('4 topsoil per load · 5 seconds');
    await page.screenshot({ path: 'test-results/gathering-rate-skilled.png' });
    delete p().inventory.shovel;
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#resource-status')).toContainText('Carry a shovel');
    await expect(page.locator('#resource-gather')).toBeDisabled();
    await page.screenshot({ path: 'test-results/gathering-rate-missing-implement.png' });
    await edit();
    const invalid = group.locator('[name="gatheringBaseYield"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-rate-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="gatheringBaseYield"]')).toHaveValue('2');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
