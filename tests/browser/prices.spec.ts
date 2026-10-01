// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
test('building admin shows saved prices, switches goods/direction and keeps edits during snapshots', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-prices-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Price tester');
    const w = createWorld('price-test', 'Price test', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 10;
    const b = makeBuilding('mill', 'mill', 0, 0);
    b.owner = p.id;
    b.name = 'My test mill';
    b.buy = { wheat: 600 };
    b.sell = { flour: 1250, wheat: 0 };
    w.buildings = [b];
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
    await page.getByRole('button', { name: /My test mill/ }).click({ timeout: 20000 });
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    const details = page.locator('[data-business-details]');
    const wage = details.getByRole('spinbutton', { name: 'Wage in denarii' });
    await expect(wage).toHaveValue('22');
    await wage.fill('10');
    await page.waitForTimeout(800);
    await expect(wage).toHaveValue('10');
    await expect(details.locator('[data-saved-wage]')).toContainText('22d');
    await details.getByRole('button', { name: 'Save details', exact: true }).click();
    await expect.poll(() => b.wage).toBe(1000);
    await expect(details.locator('[data-saved-wage]')).toContainText('10d per worker');
    await expect(wage).toHaveValue('10');
    const form = page.locator('[data-price-editor]'),
      input = form.getByRole('spinbutton', { name: 'Denarii per item' });
    await expect(input).toHaveValue('6');
    await expect(form.locator('[data-current-prices]')).toContainText('Wheat · buys: 6d');
    await input.fill('7.25');
    await page.waitForTimeout(1200);
    await expect(input).toHaveValue('7.25');
    await form.getByRole('button', { name: 'Set price', exact: true }).click();
    await expect.poll(() => b.buy.wheat).toBe(725);
    await expect(input).toHaveValue('7.25');
    await expect(form.locator('[data-saved-price]')).toContainText('7.25d');
    await form.getByLabel('Trade direction').selectOption('sell');
    await expect(input).toHaveValue('0');
    await form.getByRole('combobox', { name: 'Item', exact: true }).selectOption('flour');
    await expect(input).toHaveValue('12.5');
    await form.getByLabel('Trade direction').selectOption('buy');
    await expect(input).toHaveValue('');
    await expect(form.locator('[data-saved-price]')).toContainText('No saved price');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: /My test mill/ }).click();
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    await expect(wage).toHaveValue('10');
    await page
      .locator('[data-price-editor]')
      .getByRole('combobox', { name: 'Item', exact: true })
      .selectOption('wheat');
    await expect(page.locator('[data-price-editor] input[name=priceDenarii]')).toHaveValue('7.25');
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
