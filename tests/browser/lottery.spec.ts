// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
test('players can fund and enter the optional lottery with clear cash units', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-lottery-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Lucky pilot'),
      w = createWorld('lottery', 'Lottery', account.id, 'playground'),
      p = addPlayer(w, account.id, account.name);
    w.settings.lotteryEnabled = true;
    w.script = '';
    w.buildings = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'lottery');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Annual lottery', exact: true }).click();
    await page.getByLabel('Tickets to buy').fill('2');
    await page.getByRole('button', { name: /Buy tickets/ }).click();
    await expect.poll(() => w.lottery?.tickets[p.id]).toBe(2);
    await page.getByLabel('Jackpot contribution in denarii').fill('3.50');
    await page.getByRole('button', { name: 'Contribute own cash' }).click();
    await expect.poll(() => w.lottery?.pot).toBe(550);
    await expect(page.getByRole('dialog', { name: 'Annual lottery' })).toContainText('5.5d');
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
