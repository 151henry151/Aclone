// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { waitForWorld } from './fixtures/ready';

test('world editor exposes boat death, cargo lifetime and fuel rules and saves them', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-boat-rules-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const port = await app.listen(),
      w = app.worlds.get('puddlewick')!;
    const { account, token } = app.universe.register('Boat rules owner');
    const p = addPlayer(w, account.id, account.name);
    w.owner = p.id;
    p.authority = 100;
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.locator('.quickbar [data-do="editor"]').click();
    await page.locator('[data-do="tab"][data-id="Rules"]').click();
    const loss = page.getByLabel('Lose all owned boats on death');
    await expect(loss).toBeChecked();
    await loss.uncheck();
    await page.getByLabel('Recoverable cargo lifetime').fill('3');
    await page.getByLabel('Keep tank fuel in recoverable boats').uncheck();
    await page.screenshot({ path: 'test-results/boat-death-world-rules.png' });
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.loseBoatsOnDeath).toBe(false);
    await expect.poll(() => w.settings.boatCargoSpoilageDays).toBe(3);
    await expect.poll(() => w.settings.retainBoatFuelOnDeath).toBe(false);
    const home = makeBuilding('provisions-home', 'home', p.x, p.z);
    home.owner = p.id;
    home.stock = { bread: 3, water: 8 };
    w.buildings.push(home);
    w.revision++;
    act(w, p.id, { type: 'home', building: home.id });
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-home-provisions]')).toContainText(
      'Provisions run out in about',
    );
    await page.screenshot({ path: 'test-results/home-provisions-status.png' });
    home.stock.water = 0;
    await expect(page.locator('[data-home-provisions]')).toContainText('out of drink');
    await page.locator('[data-do="outside"]').click();
    await expect(page.locator('[data-home-provisions]')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
