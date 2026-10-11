// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { calendar, DAY_SECONDS } from '../../src/shared/environment.ts';

test('winter explains unavailable planting and an open farm refreshes in spring', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-farm-season-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Season tester');
    const w = createWorld('farm-season', 'Season Farm', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    const farm = w.buildings.find((b) => b.kind === 'farm')!;
    w.buildings = [farm];
    farm.owner = p.id;
    p.skills = ['farmer'];
    p.x = farm.x;
    p.z = farm.z + 13;
    w.time += (340 - calendar(w).dayOfYear) * DAY_SECONDS;
    farm.plots = [
      {
        crop: 'wheat',
        planted: w.time - 20 * DAY_SECONDS,
        ready: w.time - DAY_SECONDS,
        water: 0,
        fertilized: false,
      },
    ];
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
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('e');
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-planting-notice]')).toContainText(
      'No crops can be planted in winter. Planting resumes in spring.',
    );
    await expect(dialog.locator('select[name="crop"]')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Plant seeds', exact: true })).toHaveCount(0);
    await expect(dialog.locator('[data-planting-notice]')).toContainText('Unharvested crops die');
    await expect(dialog.getByText('Wheat lost to winter.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Harvest', exact: true })).toHaveCount(0);
    await page.screenshot({ path: '/tmp/aclone-winter-farm.png' });
    // Leave the dialog open as the economic calendar crosses into spring.
    w.time += (365 - calendar(w).dayOfYear + 60) * DAY_SECONDS;
    await expect(dialog.locator('[data-planting-notice]')).toHaveCount(0);
    await expect(dialog.locator('select[name="crop"]')).toHaveCount(4);
    await expect(
      dialog.locator('select[name="crop"]').first().locator('option[value="wheat"]'),
    ).toHaveCount(1);
    await expect(
      dialog.getByRole('button', { name: 'Plant seeds', exact: true }).first(),
    ).toBeEnabled();
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
