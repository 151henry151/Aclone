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
test('implement selectors persist and show current refusal and no-tool gathering', async ({
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
    initial.resources[node.id] = { amount: 3, updated: initial.time };
    initial.settings.gatheringBaseSeconds = 1;
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
    const group = page.getByRole('group', { name: 'Gathering implements', exact: true }),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      gatheringLogsImplement: 'none',
      gatheringStoneImplement: 'chainsaw',
      gatheringGravelImplement: 'pickaxe',
      gatheringDirtImplement: 'pickaxe',
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).selectOption(v);
    await apply();
    await expect.poll(() => w().settings.gatheringDirtImplement).toBe('pickaxe');
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-implement-rules.png' });
    await close();
    await expect(page.locator('#resource-control')).toBeVisible();
    await expect(page.locator('#resource-status')).toContainText('Carry a pickaxe');
    await expect(page.locator('#resource-gather')).toBeDisabled();
    await page.screenshot({ path: 'test-results/gathering-implement-refusal.png' });
    await page.locator('[data-do="resources"]:visible').click();
    await expect(page.getByRole('dialog')).toContainText('Topsoil: pickaxe');
    const row = page
      .getByRole('dialog')
      .locator('article')
      .filter({ has: page.locator(`[data-do="gather"][data-id="${node.id}"]`) });
    await expect(row).toContainText('Carry a pickaxe');
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-implement-menu.png' });
    await close();
    p().inventory = {};
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#resource-status')).toContainText('Carry a pickaxe');
    await edit();
    await group.locator('[name="gatheringDirtImplement"]').selectOption('none');
    await apply();
    await expect.poll(() => w().settings.gatheringDirtImplement).toBe('none');
    await close();
    await expect(page.locator('#resource-control')).toBeVisible();
    await expect(page.locator('#resource-gather')).toBeEnabled();
    await page.screenshot({ path: 'test-results/gathering-implement-none.png' });
    await page.locator('#resource-gather').click();
    await expect.poll(() => p().inventory.dirt).toBe(3);
    expect(p().inventory.pickaxe).toBeUndefined();
    await expect(page.locator('#resource-control')).toBeVisible();
    await expect(page.locator('#resource-status')).toContainText('needs time to replenish');
    await expect(page.locator('#resource-gather')).toBeDisabled();
    await page.screenshot({ path: 'test-results/gathering-implement-depleted.png' });
    await edit();
    const input = group.locator('[name="gatheringDirtImplement"]');
    // Exercise authoritative validation of a tampered selector without granting any tool.
    await input.evaluate((i: HTMLSelectElement) => i.add(new Option('Workshop tools', 'tools')));
    await input.selectOption('tools');
    await apply();
    await expect(page.locator('#toast')).toContainText('Choose none, chainsaw, pickaxe or shovel');
    expect(w().settings.gatheringDirtImplement).toBe('none');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/gathering-implement-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="gatheringDirtImplement"]')).toHaveValue('none');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
