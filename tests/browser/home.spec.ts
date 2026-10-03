// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';

test('leaving a home or rented room works across live updates and after reconnecting', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-home-test-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Home tester');
    const w = createWorld('home-test', 'Home test', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    p.heading = 0;
    const b = makeBuilding('shelter', 'home', 0, 0);
    b.owner = p.id;
    w.buildings = [b];
    p.home = b.id;
    p.atHome = true;
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
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${port}`);
    const outside = page.getByRole('button', { name: 'At home · Go outside' });
    for (const kind of ['home', 'bnb', 'hotel']) {
      b.kind = kind;
      if (kind !== 'home') {
        b.owner = 'innkeeper';
        b.lodging = {
          open: true,
          rate: 600,
          guests: { [p.id]: { until: w.time + 3600, stock: {} } },
        };
      }
      p.atHome = true;
      await page.reload();
      await expect(outside).toBeVisible();
      // Hold through several snapshots: replacing the node loses the click or focus.
      if (kind === 'bnb') {
        await outside.focus();
        await page.keyboard.down('Space');
        await page.waitForTimeout(450);
        await page.keyboard.up('Space');
      } else if (kind === 'hotel') {
        await outside.focus();
        await page.keyboard.press('Enter');
      } else await outside.click({ delay: 450 });
      await expect.poll(() => p.atHome).toBe(false);
      await expect(outside).toHaveCount(0, { timeout: 15000 });
      await page.reload();
      await expect(page.locator('#world-hud')).toBeVisible();
      await expect(outside).toHaveCount(0, { timeout: 15000 });
    }
    const startZ = p.z;
    await page.keyboard.down('ArrowUp');
    await expect.poll(() => p.z).toBeGreaterThan(startZ + 1);
    await page.keyboard.up('ArrowUp');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
