// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';

test('bank quotes require acceptance, create a loan, and support repayment without losing drafts', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-loan-ui-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Bank visitor');
    const w = createWorld('bank-ui', 'Bank UI', account.id);
    w.script = '';
    w.settings.hungerRate = w.settings.thirstRate = 0;
    const p = addPlayer(w, account.id, account.name);
    p.cash = 1000000;
    p.x = 0;
    p.z = 10;
    const b = makeBuilding('bank', 'bank', 0, 0);
    b.investment = 1000000;
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
    await expect(page.locator('#target')).toContainText(b.name, { timeout: 20000 });
    await page.locator('#target').click();
    const form = page.locator('#loan-quote-form');
    await form.getByLabel('Loan amount in denarii').fill('250');
    await form.getByRole('button', { name: 'Get loan quote' }).click();
    await expect(page.locator('#loan-quote-result')).toContainText('Your loan offer');
    await page.getByRole('button', { name: 'Accept loan', exact: true }).click();
    expect(p.loans).toBeUndefined();
    await page.getByLabel('I accept this payment schedule and default terms').check();
    await page.getByRole('button', { name: 'Accept loan', exact: true }).click();
    await expect.poll(() => p.loans?.length).toBe(1);
    expect(p.loans![0].original).toBe(25000);
    await expect(form.getByLabel('Loan amount in denarii')).toHaveValue('250');
    await page.getByLabel('Repayment in denarii').fill('300');
    await page.getByRole('button', { name: 'Repay loan', exact: true }).click();
    await expect.poll(() => p.loans![0].status).toBe('paid');
    await expect(page.getByLabel('Repayment in denarii')).toHaveCount(0);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
