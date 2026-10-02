// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation.ts';
import { items } from '../../src/shared/catalog.ts';

test('repeat trades preserve list scroll and quantity; capital and stock controls retain drafts across actions and tabs', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-panel-memory-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Panel tester');
    const w = createWorld('ui-test', 'UI test', account.id);
    w.script = '';
    const p = addPlayer(w, account.id, account.name);
    p.x = 0;
    p.z = 12;
    const harbour = makeBuilding('harbour', 'market', 0, 0);
    harbour.name = 'Test harbour';
    harbour.investment = 100000;
    harbour.buy = Object.fromEntries(Object.keys(items).map((id) => [id, 100]));
    harbour.sell = { ...harbour.buy };
    harbour.stock = Object.fromEntries(Object.keys(items).map((id) => [id, 30]));
    const last = Object.keys(items).at(-1)!;
    p.inventory[last] = 12;
    const mill = makeBuilding('mill', 'mill', 35, 0);
    mill.name = 'My test mill';
    mill.owner = p.id;
    mill.investment = 20000;
    mill.stock = { wheat: 20 };
    w.buildings = [harbour, mill];
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
    await page.setViewportSize({ width: 1200, height: 700 });
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole('button', { name: /Test harbour/ }).click();
    await page.locator('#trade-quantity').fill('3');
    const sell = page.locator(`[data-do=trade][data-direction=sell][data-item="${last}"]`);
    await sell.scrollIntoViewIfNeeded();
    const list = page.locator('.trade-list').nth(1);
    const beforeScroll = await list.evaluate((el) => el.scrollTop);
    expect(beforeScroll).toBeGreaterThan(100);
    await sell.click();
    await expect.poll(() => p.inventory[last]).toBe(9);
    await page.waitForTimeout(700);
    expect(Math.abs((await list.evaluate((el) => el.scrollTop)) - beforeScroll)).toBeLessThan(3);
    await expect(page.locator('#trade-quantity')).toHaveValue('3');
    await sell.click();
    await expect.poll(() => p.inventory[last]).toBe(6);
    await expect(page.locator('#trade-quantity')).toHaveValue('3');
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: /Test harbour/ }).click();
    await expect(page.locator('#trade-quantity')).toHaveValue('3');
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    p.x = mill.x;
    p.z = 12;
    await page.getByRole('button', { name: /My test mill/ }).click();
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    const capital = page.locator('form[data-action=investment]');
    await capital.locator('input[name=denarii]').fill('10');
    await capital.locator('select[name=direction]').selectOption('withdraw');
    await capital.getByRole('button', { name: 'Transfer cash' }).click();
    await expect.poll(() => mill.investment).toBe(19000);
    await page.waitForTimeout(400);
    await expect(capital.locator('input[name=denarii]')).toHaveValue('10');
    await expect(capital.locator('select[name=direction]')).toHaveValue('withdraw');
    await capital.getByRole('button', { name: 'Transfer cash' }).click();
    await expect.poll(() => mill.investment).toBe(18000);
    await page.getByRole('button', { name: 'Stockroom', exact: true }).click();
    const stock = page.locator('form[data-action=stock]');
    await stock.locator('select[name=item]').selectOption('wheat');
    await stock.locator('select[name=direction]').selectOption('withdraw');
    await stock.locator('input[name=quantity]').fill('2');
    await stock.getByRole('button', { name: 'Transfer stock' }).click();
    await expect.poll(() => mill.stock.wheat).toBe(18);
    await page.waitForTimeout(400);
    await expect(stock.locator('input[name=quantity]')).toHaveValue('2');
    await expect(stock.locator('select[name=direction]')).toHaveValue('withdraw');
    await page.getByRole('button', { name: 'Building Admin', exact: true }).click();
    await expect(capital.locator('input[name=denarii]')).toHaveValue('10');
    await expect(capital.locator('select[name=direction]')).toHaveValue('withdraw');
    await page.screenshot({ path: 'test-results/persistent-building-admin.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('panel memory scopes drafts, preserves live defaults, and excludes credentials and files', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-panel-unit-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    await page.goto(`http://127.0.0.1:${port}`);
    const result = await page.evaluate(async () => {
      const modulePath = '/src/client/panel-memory.ts';
      const { PanelMemory } = await import(modulePath);
      const host = document.createElement('div');
      document.body.append(host);
      const memory = new PanelMemory(host);
      const render = (scope: string, wage = '22') => {
        memory.capture();
        host.innerHTML = `<form data-action="investment"><input type="hidden" name="building" value="mill"><input name="amount" value="50"><select name="direction"><option value="deposit">Invest</option><option value="withdraw">Collect</option></select><input name="wage" value="${wage}"><input name="password" type="password"><input name="pilotKey"><input name="asset" type="file"></form>`;
        memory.restore(scope);
      };
      const input = (name: string) => host.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
      const edit = (name: string, value: string) => {
        input(name).value = value;
        input(name).dispatchEvent(new Event('input', { bubbles: true }));
      };
      render('one');
      edit('amount', '10');
      edit('direction', 'withdraw');
      edit('password', 'private');
      edit('pilotKey', 'private');
      render('one', '12');
      const same = [
        input('amount').value,
        input('direction').value,
        input('wage').value,
        input('password').value,
        input('pilotKey').value,
        input('asset').value,
      ];
      render('two');
      const other = input('amount').value;
      render('one');
      const back = input('amount').value;
      memory.clear();
      render('one');
      const cleared = input('amount').value;
      host.remove();
      return { same, other, back, cleared };
    });
    expect(result).toEqual({
      same: ['10', 'withdraw', '12', '', '', ''],
      other: '50',
      back: '10',
      cleared: '50',
    });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
