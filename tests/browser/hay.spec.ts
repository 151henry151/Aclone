// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { waitForWorld } from './fixtures/ready';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
test('farm expansion and hay planting are usable through the building panel', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-hay-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Hay farmer'),
      w = app.worlds.get('puddlewick')!;
    const p = addPlayer(w, account.id, account.name),
      farm = makeBuilding('hay-farm', 'farm', 150, -140),
      barn = makeBuilding('hay-store', 'haybarn', 125, -120);
    farm.owner = p.id;
    farm.investment = 100000;
    p.cash = 100000;
    p.skills = ['farmer'];
    p.x = farm.x;
    p.z = farm.z + 9;
    p.heading = Math.PI;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    farm.plots = Array.from({ length: 4 }, () => ({
      crop: 'hay',
      planted: w.time - 3000,
      ready: w.time + 3000,
      water: 1,
      fertilized: false,
    }));
    barn.stock.hay = 400;
    w.buildings = [farm, barn];
    app.store.saveWorld(w);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('e');
    await expect(page.getByRole('heading', { name: 'Farmland', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Buy four more plots/ }).click();
    await expect.poll(() => farm.farmPlots).toBe(8);
    await expect(page.getByRole('heading', { name: /8 plots/ })).toBeVisible();
    const plot = page
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: /Plot 8/ }) });
    await plot.locator('select[name=crop]').selectOption('hay');
    await plot.getByRole('button', { name: 'Plant seeds' }).click();
    await expect.poll(() => farm.plots?.[7]?.crop).toBe('hay');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: 'test-results/hay-farm-and-barn.png' });
    p.x = barn.x;
    p.z = barn.z + 11;
    p.heading = Math.PI;
    await expect(page.locator('[data-do="building"][data-id="hay-store"]')).toContainText(
      'Hay barn',
    );
    await page.keyboard.press('e');
    await expect(page.getByText(/Dry bulk storage/)).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.screenshot({ path: 'test-results/hay-barn.png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
