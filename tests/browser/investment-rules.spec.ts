// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('outside investors see live terms, retain agreed claims and collect only earned surplus', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-investment-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Investor');
    const initial = createWorld('investment-ui', 'Investment rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
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
    const shop = makeBuilding('shop', 'market', 0, 0);
    Object.assign(shop, {
      owner: 'neighbour',
      government: false,
      wage: 0,
      recipe: undefined,
      buy: {},
      sell: { water: 10000 },
      stock: { water: 10 },
      investment: 0,
    });
    initial.buildings = [shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      vehicle: 0,
      engine: false,
      cash: 1000000,
      inventory: {},
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
    const b = () => w().buildings[0];
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'investment-ui');
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
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    await edit();
    await group.locator('[name="outsideReturnPercent"]').fill('25');
    await group.locator('[name="outsideOperatingReserve"]').fill('30000');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.outsideReturnPercent).toBe(25);
    await page.keyboard.press('Escape');
    await edit();
    await expect(group.locator('[name="outsideOperatingReserve"]')).toHaveValue('30000');
    await expect(group.locator('[name="outsideReturnPercent"]')).toHaveValue('25');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/investment-rules.png' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog')).toContainText('capped at 25%');
    await page.getByRole('button', { name: 'Investment', exact: true }).click();
    const form = page.locator('[data-action="investment"]');
    await expect(form).toContainText('3s 0d');
    await form.locator('[name="denarii"]').fill('100');
    await form.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect.poll(() => b().stakes?.[0].claim).toBe(12500);
    await form.locator('[name="direction"]').selectOption('withdraw');
    await form.locator('[name="denarii"]').fill('1');
    await form.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('No earned return');
    expect(b().investment).toBe(10000);
    await page.keyboard.press('Escape');
    await edit();
    await group.locator('[name="outsideReturnPercent"]').fill('10');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.outsideReturnPercent).toBe(10);
    expect(b().stakes![0].claim).toBe(12500);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Existing claims keep their agreed terms');
    await expect(page.getByRole('dialog')).toContainText('New deposits earn up to 10%');
    await page.getByRole('button', { name: 'Investment', exact: true }).click();
    await form.locator('[name="direction"]').selectOption('deposit');
    await form.locator('[name="denarii"]').fill('100');
    await form.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect.poll(() => b().stakes![0].claim).toBe(23500);
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await page.locator('[data-do="trade"][data-item="water"][data-direction="buy"]').click();
    await expect.poll(() => b().investment).toBe(30000);
    await page.getByRole('button', { name: 'Investment', exact: true }).click();
    await form.locator('[name="direction"]').selectOption('withdraw');
    await form.locator('[name="denarii"]').fill('1');
    await form.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('No earned return');
    expect(b().investment).toBe(30000);
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await page.locator('[data-do="trade"][data-item="water"][data-direction="buy"]').click();
    await expect.poll(() => b().investment).toBe(40000);
    await page.getByRole('button', { name: 'Investment', exact: true }).click();
    await form.locator('[name="direction"]').selectOption('withdraw');
    await form.locator('[name="denarii"]').fill('50');
    await form.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect.poll(() => b().stakes![0].paid).toBe(5000);
    expect(b().investment).toBe(35000);
    await page.getByRole('button', { name: 'Main', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('collected 50d');
    await page.screenshot({ path: 'test-results/investment-claim.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
