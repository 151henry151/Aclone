// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('no saved world and an invalid saved world reach the connected directory', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-entry-'));
  const app = await createApp({ dataDir: dir, port: 0, tick: false, dev: true });
  try {
    const port = await app.listen(),
      { token } = app.universe.register('Directory check');
    for (const world of [undefined, 'no-such-world']) {
      const page = await browser.newPage(),
        errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.addInitScript(
          ({ token, world }) => {
            localStorage.setItem('aclone.pilot', token);
            if (world) localStorage.setItem('aclone.world', world);
          },
          { token, world },
        );
        await page.goto(`http://127.0.0.1:${port}`);
        await expect(page.getByRole('heading', { name: 'Somewhere to call home.' })).toBeVisible();
        await expect(page.locator('#connection')).toHaveText('CONNECTED');
        await expect(page.locator('.world-card').first()).toBeVisible();
        if (world) await expect(page.locator('#toast')).toContainText(/world/i);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
