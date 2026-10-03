// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { defaultCreator } from '../../src/shared/creator.ts';
test('live livestock renders, henhouse care works, and stock changes leave the world ready', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-herd-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Animal keeper'),
      w = app.worlds.get('puddlewick')!;
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.creator = defaultCreator();
    w.creator.weather = 'clear';
    w.creator.roads = false;
    w.creator.scenery = false;
    const p = addPlayer(w, account.id, account.name);
    p.skills = ['livestock farmer'];
    p.vehicle = 5;
    p.x = 0;
    p.z = 8;
    p.heading = Math.PI;
    const b = makeBuilding('hens', 'henhouse', 0, 0);
    b.owner = p.id;
    b.stock = { chickens: 4, feed: 100, water: 100 };
    b.investment = 10000;
    const dairy = makeBuilding('cows', 'dairy', 25, 0);
    dairy.stock = { cows: 3 };
    const sheep = makeBuilding('sheep', 'sheepfold', -25, 0);
    sheep.stock = { sheep: 3 };
    const pigs = makeBuilding('pigs', 'piggery', 0, -28);
    pigs.stock = { pigs: 3 };
    w.buildings = [b, dairy, sheep, pigs];
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
        localStorage.setItem('aclone.quality', 'low');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('e');
    await expect(page.getByRole('heading', { name: 'Livestock', exact: true })).toBeVisible();
    await expect(page.getByText(/4 chickens · 100% condition/)).toBeVisible();
    await page.getByRole('button', { name: /Arrange breeding/ }).click();
    await expect.poll(() => b.breedingEnd).toBeGreaterThan(w.time);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.keyboard.press('h');
    await page.screenshot({ path: 'test-results/livestock/in-game.png' });
    b.stock.chickens = 5;
    await page.waitForTimeout(1000);
    await page.keyboard.press('h');
    await page.keyboard.press('e');
    await expect(page.getByText(/5 chickens/)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
