// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, money } from '../../src/shared/simulation';
import { exportShipments } from '../../src/shared/export-shipments';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('export interval edits govern visible terminal cargo and revenue', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-export-rules-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Port inspector');
    const initial = createWorld('puddlewick', 'Export rules', account.id);
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
    const harbour = makeBuilding('export-port', 'market', 0, 0);
    Object.assign(harbour, {
      government: true,
      owner: 'treasury',
      investment: 0,
      stock: { tools: 200 },
    });
    initial.buildings = [harbour];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      port = () => w().buildings[0];
    const serverPort = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${serverPort}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    await edit();
    const field = page
      .getByRole('group', { name: 'Economy and trade', exact: true })
      .locator('[name="exportShipmentInterval"]');
    await field.fill('60');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.exportShipmentInterval).toBe(60);
    const anchor = w().exportShipmentAt!;
    expect(port().stock.tools).toBe(200);
    expect(port().investment).toBe(0);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    await expect(field).toHaveValue('60');
    await field.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/export-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('e');
    const row = page
      .locator('.trade-row')
      .filter({ has: page.locator('[data-do="trade"][data-item="tools"][data-direction="buy"]') });
    await expect(row).toContainText('200 /');
    w().time = anchor + 60;
    exportShipments(w(), w().time);
    expect(port().stock.tools).toBe(160);
    expect(port().investment).toBeGreaterThan(0);
    await expect(async () => {
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.keyboard.press('e');
      await expect(row).toContainText('160 /', { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await expect(page.getByRole('dialog')).toContainText(money(port().investment));
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/export-shipment.png' });
    const cash = port().investment;
    port().stock.tools = 0;
    w().time = anchor + 120;
    exportShipments(w(), w().time);
    expect(port().investment).toBe(cash);
    await expect(async () => {
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.keyboard.press('e');
      await expect(row).toContainText('0 /', { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/export-empty.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
