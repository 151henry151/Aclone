// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';

test('ownership and movement controls track live state on desktop and mobile', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-context-ui-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Context tester');
    const w = createWorld('context-ui', 'Context UI', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    const farm = w.buildings.find((b) => b.kind === 'farm')!;
    const home = w.buildings.find((b) => b.kind === 'home')!;
    w.buildings = [farm, home];
    delete farm.owner;
    p.x = farm.x;
    p.z = farm.z + 13;
    p.inventory.rc = 2;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(farm.name);
    await expect(dialog.getByRole('button', { name: 'Building Admin', exact: true })).toHaveCount(
      0,
    );
    await expect(dialog.getByRole('button', { name: 'Stockroom', exact: true })).toHaveCount(0);
    await expect(dialog.locator('form[data-action="farm"]:visible')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Investment', exact: true }).click();
    await expect(dialog).toContainText('Outside investment');
    await expect(dialog.locator('form[data-action="listProperty"]')).toHaveCount(0);
    // A live purchase changes access without closing the panel.
    farm.owner = p.id;
    await expect(dialog.getByRole('button', { name: 'Building Admin', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Building Admin', exact: true }).click();
    await expect(dialog.locator('form[data-action="listProperty"]')).toBeVisible();
    farm.owner = 'new-owner';
    await expect(dialog.locator('form[data-action="listProperty"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await expect(dialog.locator('[data-do="walk"]')).toBeVisible();
    await expect(dialog.locator('[data-do="tractor"]')).toBeHidden();
    await expect(dialog.locator('[data-do="crow"]')).toHaveText('Fly robocrow');
    p.vehicle = 5;
    await expect(dialog.locator('[data-do="walk"]')).toBeHidden();
    await expect(dialog.locator('[data-do="tractor"]')).toBeVisible();
    // Use an actual owned home so simulation keeps the sheltered state.
    home.owner = p.id;
    p.home = home.id;
    p.atHome = true;
    for (const action of ['walk', 'tractor', 'crow'])
      await expect(dialog.locator(`[data-do="${action}"]`)).toBeHidden();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-do="mobile-actions"]').click();
    for (const action of ['walk', 'tractor', 'crow', 'engine', 'lights'])
      await expect(dialog.locator(`[data-do="${action}"]`)).toBeHidden();
    p.atHome = false;
    await expect(dialog.locator('[data-do="tractor"]')).toBeVisible();
    await expect(dialog.locator('[data-do="walk"]')).toBeHidden();
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
