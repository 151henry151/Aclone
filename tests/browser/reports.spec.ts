// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, act } from '../../src/shared/simulation.ts';
import { leaveReport } from '../../src/shared/reports.ts';
test('a returning owner can read private history and a business statement', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-reports-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  try {
    const port = await app.listen();
    const { account, token } = app.universe.register('Bookkeeper');
    const w = app.worlds.get('puddlewick')!;
    const p = addPlayer(w, account.id, account.name);
    const mill = w.buildings.find((b) => b.kind === 'mill')!;
    mill.owner = p.id;
    p.x = mill.x;
    p.z = mill.z + 12;
    leaveReport(w, p);
    act(w, p.id, { type: 'investment', building: mill.id, direction: 'deposit', amount: 1000 });
    app.store.saveWorld(w);
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#pilot-name')).toHaveText('Bookkeeper');
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Journal & reports' }).click();
    await expect(page.getByRole('heading', { name: 'While you were away' })).toBeVisible();
    await expect(page.locator('#modal-host')).toContainText('Cash change: -10d');
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Statement', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Business statement' })).toBeVisible();
    await expect(page.locator('#modal-host')).toContainText('Owner capital added');
    await page.screenshot({ path: 'test-results/business-statement.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
