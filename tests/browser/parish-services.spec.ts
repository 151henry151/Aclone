// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { buildings } from '../../src/shared/catalog.ts';

test('default Puddlewick exposes the intended starter roster and production at the two new services', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-parish-browser-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const w = app.worlds.get('puddlewick')!;
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    const { token } = app.universe.register('Parish visitor');
    const port = await app.listen();
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.sound', 'off');
    }, token);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('m');
    const map = page.getByRole('dialog', { name: 'Parish map.', exact: true });
    await expect(map).toBeVisible();
    for (const definition of w.buildings)
      await expect(map.getByRole('button', { name: definition.name, exact: true })).toBeVisible();
    for (const kind of ['town', 'workshop', 'hotel', 'brewery', 'factory'])
      await expect(
        map.getByRole('button', { name: buildings[kind].name, exact: true }),
      ).toHaveCount(0);
    for (const kind of ['mason', 'waterworks']) {
      await map.getByRole('button', { name: buildings[kind].name, exact: true }).click();
      const panel = page.getByRole('dialog', { name: buildings[kind].name, exact: true });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(
        kind === 'mason' ? '3 Stone → 2 Stone blocks' : '1 Fuel → 12 Water',
      );
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await page.keyboard.press('m');
      await expect(map).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
