// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('loan rules change offers, enforce closed lending and preserve repayment', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-loan-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Borrower');
    const initial = createWorld('loan-rules', 'Loan rules', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
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
    const patch = {
      loanPersonalBaseApr: 0,
      loanPersonalAprSpread: 0,
      loanMortgageBaseApr: 2,
      loanMortgageAprSpread: 4,
      loanRateScoreSpan: 700,
      loanPersonalMinimumScore: 500,
      loanMortgageMinimumScore: 450,
      loanTerms: '3,9',
      loanMaximumActive: 1,
      loanMortgageLtv: 0.42,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.loanTerms).toBe('3,9');
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/loan-offer-rules.png' });
    await close();
    await page.locator('#target').click();
    const form = page.locator('#loan-quote-form'),
      result = page.locator('#loan-quote-result');
    await expect(form.locator('[name="months"] option')).toHaveText(['3 payments', '9 payments']);
    await form.getByLabel('Number of monthly payments').selectOption('3');
    await form.getByLabel('Loan amount in denarii').fill('90');
    const quote = () => form.getByRole('button', { name: 'Get loan quote' }).click();
    await quote();
    await expect(result).toContainText('0.00% APR');
    await expect(result).toContainText('30d');
    await page.screenshot({ path: 'test-results/loan-zero-interest.png' });
    await result.getByLabel('Pay automatically', { exact: true }).uncheck();
    await result.getByLabel('I accept this payment schedule and default terms').check();
    await result.getByRole('button', { name: 'Accept loan', exact: true }).click();
    await expect.poll(() => p().loans?.length).toBe(1);
    expect(p().loans![0].apr).toBe(0);
    expect(p().loans![0].months).toBe(3);
    expect(p().loans![0].payment).toBe(3000);
    await quote();
    await expect(result).toContainText('At most 1 active loans');
    await page.screenshot({ path: 'test-results/loan-count-failure.png' });
    await close();
    await edit();
    await group.locator('[name="loanMaximumActive"]').fill('0');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.loanMaximumActive).toBe(0);
    await close();
    await page.locator('#target').click();
    await quote();
    await expect(result).toContainText('At most 0 active loans');
    await page.getByLabel('Repayment in denarii').fill('90');
    await page.getByRole('button', { name: 'Repay loan', exact: true }).click();
    await expect.poll(() => p().loans![0].status).toBe('paid');
    await expect(page.getByLabel('Repayment in denarii')).toHaveCount(0);
    await close();
    await edit();
    await group.locator('[name="loanMaximumActive"]').fill('1');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.loanMaximumActive).toBe(1);
    await close();
    w().buildings[0].investment = 0;
    await page.locator('#target').click();
    await expect(async () => {
      await quote();
      await expect(result).toContainText('bank lacks lending capital', { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/loan-empty-capital.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
