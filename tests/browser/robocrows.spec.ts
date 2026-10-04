// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
test('combat-world players launch a class and mark or recall their drone', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-crows-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Crow pilot'),
      w = createWorld('crows', 'Crows', account.id, 'combat'),
      p = addPlayer(w, account.id, account.name);
    w.settings.crowAbilities = true;
    w.script = '';
    w.buildings = [];
    w.zones = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    p.inventory.rc = 2;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'crows');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Launch Interceptor' }).click();
    await expect.poll(() => p.crowClass).toBe('interceptor');
    await page.getByRole('button', { name: 'Mark drone position' }).click();
    await expect.poll(() => !!p.crowMark).toBe(true);
    const mark = { ...p.crowMark! };
    p.x += 20;
    await page.getByRole('button', { name: 'Recall drone to mark' }).click();
    await expect.poll(() => p.x).toBe(mark.x);
    await page.getByRole('button', { name: 'Return to body' }).click();
    await expect.poll(() => p.vehicle).toBe(0);
    expect(p.inventory.rc).toBe(1);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
