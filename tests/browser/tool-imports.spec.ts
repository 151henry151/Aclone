// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { importScarceTools } from '../../src/shared/tool-imports';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

for (const phone of [false, true])
  test(`scarce tool shipment, sold-out refusal and configurable empty interval — ${phone ? 'phone' : 'desktop'}`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    mkdirSync('output/tool-imports', { recursive: true });
    const dir = mkdtempSync(join(tmpdir(), 'aclone-tool-imports-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const { account, token } = app.universe.register('Tool buyer');
      const initial = createWorld('tool-imports', 'Harbour supplies', account.id);
      Object.assign(initial, {
        script: '',
        towns: [],
        roads: [],
        resources: {},
        terrain: [],
        airfield: undefined,
        spaceportSite: undefined,
        toolImportAt: 0,
        time: 60,
      });
      initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
      initial.landscape = {
        paths: [],
        surfaces: [],
        scatter: [],
        barriers: [],
        heightmap: Array(1089).fill(0),
      };
      Object.assign(initial.settings, {
        mapSize: 500,
        seaLevel: -10,
        dayLength: 0,
        time: 43200,
        hungerRate: 0,
        thirstRate: 0,
        salesTax: 0,
        parishOrders: false,
        arrivalAnimation: 'off',
        roadGrowthPerDay: 0,
        toolImports: true,
        toolImportItems: 'chainsaw',
        toolImportInterval: 60,
        toolImportChance: 1,
      });
      const shop = makeBuilding('harbour', 'market', 0, 0);
      Object.assign(shop, {
        name: 'Harbour stores',
        owner: 'treasury',
        government: true,
        stock: {},
        buy: { chainsaw: 8240 },
        sell: { chainsaw: 12400 },
        investment: 100000,
      });
      initial.buildings = [shop];
      const player = addPlayer(initial, account.id, account.name);
      Object.assign(player, {
        x: 0,
        z: 10,
        y: 0,
        vehicle: 5,
        cash: 30000,
        inventory: {},
        engine: false,
      });
      importScarceTools(initial, 60);
      expect(shop.stock.chainsaw).toBe(1);
      // Prevent another automatic delivery during slow browser startup; the editor
      // below exercises changed timing and a deliberately empty next interval.
      initial.settings.toolImportInterval = 1800;
      initial.settings.toolImportChance = 0.5;
      app.worlds.set(initial.id, initial);
      const w = () => app.worlds.get(initial.id)!,
        p = () => w().players[account.id],
        b = () => w().buildings[0];
      const port = await app.listen();
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'tool-imports');
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
        },
        { token },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(page);
      await page.keyboard.press('e');
      const notice = page.locator('[data-tool-imports]');
      await expect(notice).toContainText('availability is limited');
      const buy = page.locator('[data-do="trade"][data-item="chainsaw"][data-direction="buy"]');
      const row = page.locator('.trade-row').filter({ has: buy });
      await expect(row).toContainText('1 / 500 in stock');
      await expect(row).toContainText('1s 24d');
      await buy.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/tool-imports/${phone ? 'phone' : 'desktop'}-delivery.png`,
      });
      await buy.click();
      await expect.poll(() => p().inventory.chainsaw).toBe(1);
      await expect(row).toContainText('0 / 500 in stock');
      expect(p().cash).toBe(17600);
      await buy.click();
      await expect(page.locator('#toast')).toContainText(/stock/i);
      expect(p().cash).toBe(17600);
      expect(b().stock.chainsaw).toBe(0);
      await page.screenshot({
        path: `output/tool-imports/${phone ? 'phone' : 'desktop'}-empty.png`,
      });
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      const group = page.getByRole('group', { name: 'Scarce tool imports', exact: true });
      await group.locator('[name="toolImportChance"]').fill('0');
      await group.locator('[name="toolImportInterval"]').fill('60');
      await group.locator('[name="toolImportItems"]').fill('chainsaw,shovel');
      await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
      await expect.poll(() => w().settings.toolImportChance).toBe(0);
      const cursor = w().toolImportAt!;
      importScarceTools(w(), cursor + 60);
      expect(b().stock.chainsaw).toBe(0);
      expect(b().stock.shovel ?? 0).toBe(0);
      await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      await expect(group.locator('[name="toolImportChance"]')).toHaveValue('0');
      await expect(group.locator('[name="toolImportInterval"]')).toHaveValue('60');
      await expect(group.locator('[name="toolImportItems"]')).toHaveValue('chainsaw,shovel');
      await group.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/tool-imports/${phone ? 'phone' : 'desktop'}-rules.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
