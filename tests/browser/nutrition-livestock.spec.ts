// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
test('nutrition fields and dairy care are usable from game panels', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-food-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Dairy keeper'),
      w = app.worlds.get('puddlewick')!;
    w.owner = account.id;
    const p = addPlayer(w, account.id, account.name);
    p.authority = 20;
    p.skills = ['livestock farmer'];
    p.health = 45000;
    p.inventory['custom:herbal_tea'] = 1;
    const b = makeBuilding('dairy-demo', 'dairy', 0, 0);
    b.owner = p.id;
    b.stock = { cows: 2, feed: 100, water: 100 };
    b.investment = 100000;
    w.buildings = [b];
    app.store.saveWorld(w);
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
    const form = page.locator('#creator-catalogue-item-form');
    await form.getByLabel('Thirst relief').fill('10000');
    await form.getByLabel('Health per serving', { exact: true }).fill('1200');
    await form.getByLabel('Maximum health per serving (this life)', { exact: true }).fill('200');
    await form.getByRole('button', { name: 'Save item' }).click();
    await expect.poll(() => w.catalogue?.items['custom:herbal_tea']?.health).toBe(1200);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('i');
    await expect(page.getByText(/Maximum health \+200 this life/)).toBeVisible();
    await page.locator('[data-do=use][data-id="custom:herbal_tea"]').click();
    await expect.poll(() => p.nutrition).toBe(200);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('e');
    await expect(page.getByRole('heading', { name: 'Dairy herd' })).toBeVisible();
    await page.getByRole('button', { name: /Arrange breeding/ }).click();
    await expect.poll(() => b.breedingEnd).toBeGreaterThan(w.time);
    await expect(page.getByText(/Calf due in/)).toBeVisible();
    await page.getByRole('heading', { name: 'Dairy herd' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/dairy-care-panel.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
