// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, act } from '../../src/shared/simulation.ts';

test('owners get stock and capital controls instead of self-trading and employment', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-owner-ui-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Business owner');
    const w = createWorld('owner-ui', 'Owner UI', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name),
      b = w.buildings.find((b) => b.kind === 'mill')!;
    b.owner = p.id;
    b.stock.flour = 10;
    b.efficiency = 0.01;
    p.inventory.wheat = 5;
    p.x = b.x;
    p.z = b.z + 13;
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
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#target')).toContainText(b.name);
    await page.keyboard.press('e');
    await expect(page.getByRole('dialog')).toContainText('Your business');
    await expect(page.locator('.building-meta')).toContainText('1%');
    await expect(page.getByRole('dialog')).toContainText('Next production check in');
    const worker = addPlayer(w, 'miller', 'Test miller');
    worker.skills = ['miller'];
    worker.x = b.x;
    worker.z = b.z + 12;
    act(w, worker.id, { type: 'job', building: b.id });
    await expect(page.locator('.building-meta')).toContainText('100%');
    expect(b.stock.flour).toBe(10);
    await page.screenshot({ path: 'test-results/mill-production-status.png' });
    await expect(page.locator('[data-do="trade"],[data-do="job"],[data-do="work"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Stockroom', exact: true }).click();
    await page.locator('form[data-action="stock"] select[name="item"]').selectOption('wheat');
    await page.getByLabel('Quantity', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Transfer stock', exact: true }).click();
    await expect.poll(() => p.inventory.wheat).toBe(3);
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Working capital');
    await page.screenshot({ path: 'test-results/owner-controls.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
