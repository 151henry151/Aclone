// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('gift drafts and bank/investment forms obey world transfer limits', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-transfers-ui-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Saver');
    const initial = createWorld('transfers-ui', 'Transfer limits', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      salesTax: 0,
      dayLength: 0,
      time: 43200,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const bank = makeBuilding('bank', 'bank', 0, 0),
      shop = makeBuilding('shop', 'market', 100, 0);
    shop.owner = 'neighbour';
    shop.government = false;
    shop.investment = 0;
    initial.buildings = [bank, shop];
    const player = addPlayer(initial, account.id, account.name),
      neighbour = addPlayer(initial, 'neighbour', 'Neighbour');
    for (const p of [player, neighbour])
      Object.assign(p, { x: 0, y: 0, z: 10, engine: false, online: true, cash: 100000, bank: 0 });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id],
      q = () => w().players.neighbour;
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'transfers-ui');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    await edit();
    const group = page.getByRole('group', { name: 'Economy and trade', exact: true });
    await group.locator('[name="maximumMoneyGift"]').fill('2575');
    await group.locator('[name="cashTransferLimit"]').fill('321');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.cashTransferLimit).toBe(321);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    await expect(group.locator('[name="maximumMoneyGift"]')).toHaveValue('2575');
    await expect(group.locator('[name="cashTransferLimit"]')).toHaveValue('321');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/money-transfer-rules.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Players & roadside help', exact: true }).click();
    await page.locator('#modal-host [data-do=player]').click();
    const gift = page.locator('#money-gift-form'),
      input = gift.locator('[name="denarii"]');
    await expect(input).toHaveAttribute('max', '25.75');
    await input.fill('25.76');
    await expect(gift.getByRole('button')).toBeDisabled();
    await expect(page.locator('#gift-status')).toContainText('25.75d');
    await input.fill('25.75');
    await gift.getByRole('button').click();
    await expect.poll(() => q().cash).toBe(102575);
    await input.fill('20');
    act(w(), p().id, { type: 'settings', patch: { maximumMoneyGift: 1000 } });
    await expect(input).toHaveValue('20');
    await expect(input).toHaveAttribute('max', '10');
    await expect(gift.getByRole('button')).toBeDisabled();
    await expect(page.locator('#gift-status')).toContainText('10d');
    await page.screenshot({ path: 'test-results/money-gift-draft.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('e');
    const bankForm = page.locator('[data-action="bank"]'),
      amount = bankForm.locator('[name="denarii"]');
    await expect(amount).toHaveAttribute('max', '3.21');
    await amount.fill('3.22');
    expect(await amount.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    await amount.fill('3.21');
    await bankForm.getByRole('button', { name: 'Transfer', exact: true }).click();
    await expect.poll(() => p().bank).toBe(321);
    await bankForm.locator('[name="direction"]').selectOption('withdraw');
    await bankForm.getByRole('button', { name: 'Transfer', exact: true }).click();
    await expect.poll(() => p().bank).toBe(0);
    await bankForm.getByRole('button', { name: 'Transfer', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Insufficient funds');
    expect(p().bank).toBe(0);
    await bankForm.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/money-bank-empty.png' });
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    // Position the test player at the second counter; travel is outside this form test.
    p().x = 100;
    await expect(page.locator('#target')).toContainText(shop.name);
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'Investment', exact: true }).click();
    const investment = page.locator('[data-action="investment"]'),
      stake = investment.locator('[name="denarii"]');
    await expect(stake).toHaveAttribute('max', '3.21');
    await stake.fill('3.22');
    expect(await stake.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
    await stake.fill('3.21');
    await investment.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect.poll(() => w().buildings[1].stakes?.[0].principal).toBe(321);
    await investment.locator('[name="direction"]').selectOption('withdraw');
    await stake.fill('1');
    await investment.getByRole('button', { name: 'Transfer cash', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('No earned return');
    expect(w().buildings[1].stakes![0].paid).toBe(0);
    await page.screenshot({ path: 'test-results/money-investment-empty.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
