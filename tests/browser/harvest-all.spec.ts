// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { waitForWorld } from './fixtures/ready';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { cropStatus } from '../../src/shared/farming.ts';

test('harvest all names the stockroom share and starts the longer task', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-harvest-all-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Harvest tester');
    const w = createWorld('harvest-all', 'Harvest Farm', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    const farm = w.buildings.find((b) => b.kind === 'farm')!;
    w.buildings = [farm];
    farm.owner = p.id;
    farm.investment = 100000;
    farm.stock = {};
    p.skills = ['farmer'];
    p.x = farm.x;
    p.z = farm.z + 13;
    farm.plots = [0, 1].map(() => ({
      crop: 'wheat',
      planted: w.time,
      ready: w.time - 60,
      water: 0,
      fertilized: false,
    }));
    farm.capacity = cropStatus(w, farm, 0).yield;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-harvest-all]')).toContainText('room for 50%');
    await expect(dialog.locator('[data-harvest-all]')).toContainText('only that share');
    await expect(dialog.locator('[data-harvest-all]')).toContainText('22.5 seconds');
    const batch = dialog.getByRole('button', { name: 'Harvest all · 50%' });
    await expect(batch).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Harvest', exact: true })).toHaveCount(2);
    await batch.click();
    await expect(page.locator('#task-name')).toHaveText('Harvesting crops');
    await expect(page.locator('#task-countdown')).toHaveText(/^(22|23)$/);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
