// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('loan affordability rules persist, bound quotes, refuse invalid edits and preserve debt', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-loan-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('loan-rules', 'Loan rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      parishOrders: false,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const bank = makeBuilding('bank', 'bank', 0, 0);
    bank.investment = 1000000;
    initial.buildings = [bank];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, { x: 0, y: 0, z: 10, engine: false, cash: 1000000 });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!,
      p = () => w().players[account.id];
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: initial.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Loan offers', exact: true });
    const business = page.getByRole('group', { name: 'Resident business budgets', exact: true });
    const patch = {
      loanLiquidityReserve: 12345,
      loanIncomePaymentShare: 0.27,
      loanLiquidPaymentDivisor: 7,
      loanPersonalLimit: 7000,
      loanIncomeBorrowingMonths: 9,
      loanLiquidBorrowingShare: 0.37,
      loanMinimumAmount: 2000,
      loanMaximumAmount: 8000,
      npcLoanMinimumShortfall: 222,
      npcLoanMaximumShortfall: 33333,
      npcLoanPaymentBuffer: 4,
      npcLoanProfitBatches: 31,
    };
    await edit();
    for (const [k, v] of Object.entries(patch)) await page.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.loanMaximumAmount).toBe(8000);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(page.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="loanLiquidityReserve"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/loan-affordability-rules.png' });
    await business.locator('[name="npcLoanMinimumShortfall"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/resident-loan-budgets.png' });
    await close();
    await page.locator('#target').click();
    const form = page.locator('#loan-quote-form'),
      result = page.locator('#loan-quote-result'),
      amount = form.getByLabel('Loan amount in denarii');
    await expect(amount).toHaveAttribute('min', '20');
    await expect(amount).toHaveAttribute('max', '80');
    await expect(amount).toHaveValue('80');
    await amount.fill('50');
    const quote = () => form.getByRole('button', { name: 'Get loan quote' }).click();
    await quote();
    await expect(result.getByRole('button', { name: 'Accept loan', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/loan-affordability-quote.png' });
    await result.getByLabel('Pay automatically', { exact: true }).uncheck();
    await result.getByLabel('I accept this payment schedule and default terms').check();
    await result.getByRole('button', { name: 'Accept loan', exact: true }).click();
    await expect.poll(() => p().loans?.length).toBe(1);
    const signed = structuredClone(p().loans![0]);
    await close();
    await edit();
    await group.locator('[name="loanPersonalLimit"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.loanPersonalLimit).toBe(0);
    expect(p().loans![0]).toEqual(signed);
    await close();
    await page.locator('#target').click();
    await amount.fill('50');
    const cash = p().cash;
    await quote();
    await expect(result).toContainText('Current borrowing limit is 0.00d');
    expect(p().cash).toBe(cash);
    await page.screenshot({ path: 'test-results/loan-affordability-closed.png' });
    await page.getByLabel('Repayment in denarii').fill('50');
    await page.getByRole('button', { name: 'Repay loan', exact: true }).click();
    await expect.poll(() => p().loans![0].status).toBe('paid');
    await close();
    await edit();
    await group.locator('[name="loanMinimumAmount"]').fill('8001');
    await apply();
    await expect(page.locator('#toast')).toHaveText(
      'Minimum loan amount must not exceed its maximum',
    );
    await expect(page.locator('#toast')).toHaveCSS('opacity', '1');
    await expect(page.locator('#toast')).toHaveCSS('color', 'rgb(255, 241, 213)');
    await page.screenshot({ path: 'test-results/loan-affordability-invalid.png' });
    expect(w().settings.loanMinimumAmount).toBe(2000);
    await group.locator('[name="loanMinimumAmount"]').fill('2000');
    await business.locator('[name="npcLoanMinimumShortfall"]').fill('33334');
    await apply();
    await expect(page.locator('#toast')).toHaveText(
      'Resident loan minimum shortfall must not exceed its maximum',
    );
    expect(w().settings.npcLoanMinimumShortfall).toBe(222);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="loanMinimumAmount"]')).toHaveValue('2000');
    await expect(business.locator('[name="npcLoanMinimumShortfall"]')).toHaveValue('222');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
