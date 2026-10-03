// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
test('shipyard describes roles and journey buttons show the charged fuel and duration', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-ships-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Ship shopper');
    account.credits = 2000;
    app.universe.save(account);
    await page.addInitScript((token) => localStorage.setItem('aclone.pilot', token), token);
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole('button', { name: 'Shipyard & space trade' }).click();
    await expect(page.getByRole('heading', { name: 'Needle courier' })).toBeVisible();
    await expect(page.getByText(/Shielded frontier transport/)).toBeVisible();
    await page.locator('[data-do=ship][data-id=courier]').click();
    await expect(page.locator('[data-do=ship][data-id=courier]')).toHaveText('Current ship');
    await page.screenshot({ path: 'test-results/ship-roles.png' });
    await page.getByRole('button', { name: 'Close dialog' }).click();
    const jump = page.locator('[data-do=jump][data-id=brindle]');
    await expect(jump).toContainText('5cr / 10s');
    await jump.click();
    await expect(page.getByText(/Jumping to Brindle/)).toBeVisible();
    expect(app.universe.authenticate(token)!.credits).toBe(1755);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
