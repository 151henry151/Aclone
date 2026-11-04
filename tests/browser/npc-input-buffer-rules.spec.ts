// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { inputStockTarget } from '../../src/server/npc/business-policy';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('business input buffer editor saves targets including zero and rejects inverted batch bounds', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-input-buffers-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Buffer owner'),
      initial = createWorld('input-buffers', 'Input buffers', account.id);
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
    initial.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const b = makeBuilding('bakery', 'bakery', 50, 50);
    b.owner = account.id;
    b.capacity = 100;
    b.stock = { flour: 0, bread: 0 };
    b.investment = 100000;
    b.production = {
      skill: 'baker',
      seconds: 600,
      tier: 1,
      inputs: { flour: 2 },
      outputs: { bread: 3 },
    };
    initial.buildings = [b];
    const p0 = addPlayer(initial, account.id, account.name);
    Object.assign(p0, { x: 0, z: 0, y: 0, engine: false, cash: 10000, inventory: {} });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      factory = () => w().buildings.find((v) => v.id === b.id)!,
      target = () => inputStockTarget(factory(), 'flour', w());
    expect(target()).toBe(12);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'input-buffers');
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
      group = page.getByRole('group', { name: 'Resident business budgets', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      npcInputReserveBatches: 2,
      npcInputMaximumBatches: 7,
      npcInputSalesHours: 3.5,
      npcOutputCapacityShare: 0.5,
      npcOutputMinimumBatches: 19,
      npcOutputBufferMultiplier: 1.5,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(target).toBe(4);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-input-buffers.png' });
    await group.locator('[name="npcInputReserveBatches"]').fill('0');
    await group.locator('[name="npcInputMaximumBatches"]').fill('0');
    await apply();
    await expect.poll(target).toBe(0);
    expect(factory().stock).toEqual({ flour: 0, bread: 0 });
    expect(factory().investment).toBe(100000);
    expect(w().players[account.id].cash).toBe(10000);
    await close();
    await edit();
    await expect(group.locator('[name="npcInputReserveBatches"]')).toHaveValue('0');
    await expect(group.locator('[name="npcInputMaximumBatches"]')).toHaveValue('0');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-input-buffers-zero.png' });
    await group.locator('[name="npcInputReserveBatches"]').fill('1');
    await apply();
    await expect(page.locator('#toast')).toContainText(
      'Input reserve minimum must not exceed its maximum',
    );
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    expect(w().settings.npcInputReserveBatches).toBe(0);
    expect(target()).toBe(0);
    await page.screenshot({ path: 'test-results/resident-input-buffers-refusal.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries({
      ...patch,
      npcInputReserveBatches: 0,
      npcInputMaximumBatches: 0,
    }))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
