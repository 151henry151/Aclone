// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, advance } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('keeper wage cap controls shown and paid wages while preserving employment', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-keeper-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Keeper');
    const initial = createWorld('keeper-rules', 'Keeper rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 60,
      activeWork: false,
      wageTax: 0,
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
    const bank = makeBuilding('light', 'lighthouse', 0, 0);
    bank.investment = 0;
    bank.owner = account.id;
    initial.buildings = [bank];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false, cash: 0 });
    const other = app.universe.register('Visitor');
    Object.assign(addPlayer(initial, other.account.id, other.account.name), {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
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
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    await edit();
    await group.locator('[name="lighthouseWageCap"]').fill('321');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.lighthouseWageCap).toBe(321);
    await close();
    await edit();
    await expect(group.locator('[name="lighthouseWageCap"]')).toHaveValue('321');
    await group.locator('[name="lighthouseWageCap"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/keeper-rule.png' });
    await close();
    await page.locator('#target').click();
    await expect(page.getByRole('dialog')).toContainText('Keeper wage: 3.21d per game day');
    await page.getByRole('button', { name: 'Take keeper job', exact: true }).click();
    await expect.poll(() => p().job).toBe(bank.id);
    advance(w(), 60);
    expect(p().cash).toBe(321);
    expect(w().buildings[0].investment).toBe(400);
    await page.getByRole('button', { name: 'Renew keeper shift', exact: true }).click();
    await expect(page.locator('#cash')).toHaveText('3.21d');
    await page.screenshot({ path: 'test-results/keeper-paid.png' });
    const context = await page.context().browser()!.newContext();
    try {
      const visitor = await context.newPage();
      visitor.on('pageerror', (e) => errors.push(e.message));
      await visitor.addInitScript(
        ({ token, world }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', world);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token: other.token, world: initial.id },
      );
      await visitor.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(visitor);
      await visitor.locator('#target').click();
      await expect(
        visitor.getByRole('button', { name: 'Take keeper job', exact: true }),
      ).toBeDisabled();
      await visitor.screenshot({ path: 'test-results/keeper-full.png' });
    } finally {
      await context.close();
    }
    await close();
    await edit();
    await group.locator('[name="lighthouseWageCap"]').fill('0');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.lighthouseWageCap).toBe(0);
    await close();
    await page.locator('#target').click();
    await expect(page.getByRole('dialog')).toContainText('Keeper wage: 0d per game day');
    advance(w(), 60);
    expect(p().cash).toBe(321);
    expect(w().buildings[0].investment).toBe(800);
    await expect(
      page.getByRole('button', { name: 'Enter keeper quarters', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/keeper-zero-pay.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
