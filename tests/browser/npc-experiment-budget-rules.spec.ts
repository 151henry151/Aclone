// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { inventHypotheses } from '../../src/server/npc/hypotheses';
import type { ResidentState } from '../../src/server/npc/memory';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('experiment budget rules persist, change funding and refuse invalid values', async ({
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
    const shop = makeBuilding('shop', 'market', 50, 0);
    Object.assign(shop, {
      owner: account.id,
      wage: 0,
      investment: 0,
      stock: {},
      buy: { flour: 100 },
      sell: {},
    });
    initial.buildings = [shop];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 0,
      y: 0,
      z: 10,
      engine: false,
      cash: 10000,
      fuel: 100,
      inventory: {},
    });
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
    const state: ResidentState = {
      playerId: account.id,
      world: initial.id,
      name: account.name,
      personality: 'Helpful',
      notebook: '',
      intent: '',
      cursor: 0,
      nextAt: 0,
      plan: [],
      index: 0,
      repeats: 0,
      until: 0,
      waitUntil: 0,
      status: 'Ready',
      errors: 0,
    };
    const funding = () =>
      inventHypotheses(w(), p(), state)
        .find((c) => c.idea === 'fund shop')
        ?.plan.flatMap((s) =>
          s.kind === 'act' && s.action.type === 'investment' ? [s.action.amount] : [],
        )[0];
    expect(funding()).toBe(2000);
    const group = page.getByRole('group', { name: 'Resident business budgets', exact: true });
    await edit();
    const patch = {
      npcExperimentCashFloor: 250,
      npcExperimentOwnerFundingUnits: 6,
      npcExperimentRestockBatches: 3,
      npcExperimentLoadLimit: 4,
    };
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await apply();
    await expect.poll(() => w().settings.npcExperimentCashFloor).toBe(250);
    expect(funding()).toBe(600);
    expect(p().cash).toBe(10000);
    expect(w().buildings[0].investment).toBe(0);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.locator('[name="npcExperimentCashFloor"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/experiment-budget-rules.png' });
    const invalid = group.locator('[name="npcExperimentOwnerFundingUnits"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validationMessage)).toContain(
      '1',
    );
    await page.screenshot({ path: 'test-results/experiment-budget-invalid.png' });
    expect(w().settings.npcExperimentOwnerFundingUnits).toBe(6);
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="npcExperimentOwnerFundingUnits"]')).toHaveValue('6');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
