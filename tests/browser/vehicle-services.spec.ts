// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { vehicleRecord } from '../../src/shared/vehicle-services.ts';
test('garage repairs and optional maps are usable on a phone', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-vehicles-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Motorist');
    const w = app.worlds.get('puddlewick')!,
      p = addPlayer(w, account.id, account.name);
    p.cash = 100000;
    p.inventory.steel = 2;
    vehicleRecord(w, p).condition = 50;
    w.settings.requireMapItem = true;
    const b = makeBuilding('garage-demo', 'garage', 0, 0);
    w.buildings = [b];
    app.store.saveWorld(w);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.getByText(/This world requires a Parish map/)).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Service vehicle', exact: true }).click();
    await expect.poll(() => vehicleRecord(w, p).condition).toBe(75);
    await expect(page.getByText(/condition 75.0%/)).toBeVisible();
    await page.getByRole('button', { name: 'Buy parish map', exact: true }).click();
    await expect.poll(() => p.inventory.parishMap).toBe(1);
    await expect(page.getByRole('button', { name: 'Buy parish map', exact: true })).toBeDisabled();
    await page
      .getByRole('heading', { name: 'Vehicle service', exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/vehicle-service-phone.png' });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('m');
    await expect(page.locator('#parish-map')).toBeVisible();
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
