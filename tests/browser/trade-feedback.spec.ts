// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';

test('repeated confirmed trades show totals after closing and reset for the next visit', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-trade-feedback-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    await page.setViewportSize({ width: 960, height: 600 });
    const { account, token } = app.universe.register('Trader');
    const w = createWorld('trades', 'Trades', 'owner');
    const b = w.buildings.find((b) => b.kind === 'market')!;
    w.buildings = [b];
    w.zones = [];
    w.script = '';
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { x: b.x, z: b.z + 12, cash: 100000, inventory: {} });
    b.stock.water = 10;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'trades');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.locator('#target button').click();
    const buy = page.locator('[data-do="trade"][data-item="water"][data-direction="buy"]');
    for (let i = 0; i < 10; i++) await buy.click();
    await expect.poll(() => p.inventory.water).toBe(10);
    await expect(page.locator('#toast')).toContainText('Bought 10 Water');
    await buy.click();
    await expect(page.locator('#toast')).toContainText('Not enough stock');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('#toast')).toContainText('Bought 10 Water');
    // A rejected action restores the server's world snapshot; use its current object.
    app.worlds.get(w.id)!.buildings.find((shop) => shop.id === b.id)!.stock.water = 2;
    await page.locator('#target button').click();
    await buy.click();
    await expect(page.locator('#toast')).toContainText('Bought 1 Water');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('#toast')).toContainText('Bought 1 Water');
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
