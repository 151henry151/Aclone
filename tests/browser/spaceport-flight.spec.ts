// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { spaceportFlight } from '../../src/shared/spaceport-flight.ts';
test('an arriving client renders an ongoing launch and subsequent landing without shader errors', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-launch-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Launch observer'),
      w = app.worlds.get('puddlewick')!;
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.buildings = [makeBuilding('port', 'starport', 0, 0)];
    const launch = spaceportFlight(w.id, 0).next;
    w.time = launch + 20;
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('e');
    await expect(page.getByText(/Cargo ship: ascending/)).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    w.time = launch + 280;
    await page.waitForTimeout(1200);
    await page.keyboard.press('e');
    await expect(page.getByText(/Cargo ship: landing/)).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
