// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('credit rules change scores and offers while preserving signed loans', async ({ page }) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-credit-rules-')),
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
    const group = page.getByRole('group', { name: 'Credit score', exact: true });
    const patch = {
      creditScoreMinimum: 100,
      creditScoreMaximum: 900,
      creditScoreInitial: 700,
      creditHistoryMonthlyPoints: 0,
      creditHistoryMaximum: 30,
      creditOnTimePoints: 0,
      creditOnTimeMaximum: 40,
      creditEmploymentPoints: 0,
      creditAssetUnit: 80000,
      creditAssetMaximum: 0,
      creditLatePoints: 0,
      creditDefaultPoints: 0,
      creditPenaltyMaximum: 50,
      creditDebtPoints: 0,
      creditDebtMaximum: 60,
      creditDebtDenominatorMinimum: 50000,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.creditScoreInitial).toBe(700);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="creditScoreInitial"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/credit-rules.png' });
    await close();
    await page.locator('#target').click();
    const form = page.locator('#loan-quote-form'),
      result = page.locator('#loan-quote-result');
    await expect(page.locator('[data-credit-score]')).toContainText('700 / 900');
    await form.getByLabel('Loan amount in denarii').fill('100');
    const quote = () => form.getByRole('button', { name: 'Get loan quote' }).click();
    await quote();
    await expect(result).toContainText('20.29% APR');
    await page.screenshot({ path: 'test-results/credit-score-offer.png' });
    await result.getByLabel('Pay automatically', { exact: true }).uncheck();
    await result.getByLabel('I accept this payment schedule and default terms').check();
    await result.getByRole('button', { name: 'Accept loan', exact: true }).click();
    await expect.poll(() => p().loans?.length).toBe(1);
    const apr = p().loans![0].apr,
      payment = p().loans![0].payment;
    expect(apr).toBe(0.2029);
    await close();
    await edit();
    await group.locator('[name="creditScoreInitial"]').fill('400');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.creditScoreInitial).toBe(400);
    await close();
    await page.locator('#target').click();
    await expect(page.locator('[data-credit-score]')).toContainText('400 / 900');
    await quote();
    await expect(result).toContainText('Improve repayment history');
    expect(p().loans![0].apr).toBe(apr);
    expect(p().loans![0].payment).toBe(payment);
    await page.screenshot({ path: 'test-results/credit-score-refusal.png' });
    await page.getByLabel('Repayment in denarii').fill('110');
    await page.getByRole('button', { name: 'Repay loan', exact: true }).click();
    await expect.poll(() => p().loans![0].status).toBe('paid');
    await close();
    await edit();
    await group.locator('[name="creditScoreMinimum"]').fill('950');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('minimum ≤ starting ≤ maximum');
    expect(w().settings.creditScoreMinimum).toBe(100);
    expect(w().settings.creditScoreInitial).toBe(400);
    expect(w().settings.creditScoreMaximum).toBe(900);
    await page.screenshot({ path: 'test-results/credit-invalid-bounds.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
