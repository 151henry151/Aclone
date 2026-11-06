// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../../src/server/puddlewick-boatyard';
import { boatLandings } from '../../src/shared/boathouse';
import { travelHeight } from '../../src/shared/dock';
import { waitForWorld } from './fixtures/ready';
test('captain buys a coaster and loads, cancels, trades, moors and reboards with a separate hold', async ({
  page,
}) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-freight-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const { account, token } = app.universe.register('Coaster captain');
  const w = createWorld('puddlewick', 'Coastal freight', account.id);
  w.script = '';
  ensurePuddlewickBoatyard(w);
  Object.assign(w.settings, {
    hungerRate: 0,
    thirstRate: 0,
    dayLength: 0,
    time: 43200,
    requireCaptainSkill: false,
    vehicleLicences: false,
    parishOrders: false,
  });
  const d = boatLandings(w, 35).find((d) => d.building)!;
  const p = addPlayer(w, account.id, account.name);
  Object.assign(p, d.land, {
    y: travelHeight(w, d.land.x, d.land.z),
    vehicle: 5,
    inventory: { stone: 10 },
    cash: 10000000,
  });
  d.building!.owner = 'merchant';
  d.building!.stock.stone = 2000;
  d.building!.stock.fuel = 200;
  d.building!.sell.stone = 600;
  d.building!.buy.stone = 700;
  d.building!.investment = 3000000;
  app.worlds.set(w.id, w);
  const current = () => app.worlds.get(w.id)!,
    me = () => current().players[p.id];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const port = await app.listen();
  await page.addInitScript(
    ({ token, world }) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', world);
      localStorage.setItem('aclone.quality', 'normal');
      localStorage.setItem('aclone.sound', 'off');
    },
    { token, world: w.id },
  );
  try {
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('i');
    const blocker = makeBuilding(
      'berth-blocker',
      'home',
      d.berth.x + Math.sin(d.heading) * 25,
      d.berth.z + Math.cos(d.heading) * 25,
    );
    current().buildings.push(blocker);
    const originalCash = me().cash;
    await page.getByRole('button', { name: /Buy and board Coastal cargo boat/ }).click();
    await expect(page.locator('#toast')).toContainText(/blocked|clear|occupied/i);
    expect(me().vehicle).toBe(5);
    expect(me().cash).toBe(originalCash);
    await page.screenshot({ path: 'output/cargo-boat-scale/blocked-berth.png' });
    current().buildings = current().buildings.filter((b) => b.id !== blocker.id);
    await page.getByRole('button', { name: /Buy and board Coastal cargo boat/ }).click();
    await expect.poll(() => me().vehicle).toBe(35);
    const panel = page.locator('[data-freight-slot="35"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Hold empty');
    const load = panel
      .locator('form[data-action="boatHold"]')
      .filter({ has: page.locator('input[name="operation"][value="load"]') })
      .filter({ hasNot: page.locator('input[name="building"]') });
    await load.locator('[name="quantity"]').fill('10');
    await load.getByRole('button', { name: 'Load inventory', exact: true }).click();
    await expect(panel).toContainText('Transfer in progress');
    await expect.poll(() => me().boatHold?.stone).toBe(10);
    const unload = panel
      .locator('form[data-action="boatHold"]')
      .filter({ has: page.locator('input[name="operation"][value="unload"]') })
      .filter({ hasNot: page.locator('input[name="building"]') });
    await unload.locator('[name="quantity"]').fill('10');
    await unload.getByRole('button', { name: 'Unload to inventory', exact: true }).click();
    await panel.getByRole('button', { name: 'Cancel transfer', exact: true }).click();
    await expect.poll(() => me().task).toBeUndefined();
    expect(me().boatHold?.stone).toBe(10);
    const buy = panel
      .locator('form[data-action="trade"]')
      .filter({ has: page.locator('input[name="direction"][value="buy"]') })
      .first();
    await buy.locator('[name="item"]').selectOption('stone');
    await buy.locator('[name="quantity"]').fill('10');
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect.poll(() => me().boatHold?.stone).toBe(20);
    // Editing a quantity must not silently accept a merchant's changed unit price.
    await buy.locator('[name="quantity"]').fill('1');
    current().buildings.find((b) => b.id === d.id)!.sell.stone = 900;
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('The price changed');
    expect(me().boatHold?.stone).toBe(20);
    current().buildings.find((b) => b.id === d.id)!.sell.stone = 600;

    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const navigationRulesPanel = page.getByRole('group', { name: 'Boat navigation', exact: true });
    await expect(navigationRulesPanel.locator('[name="freightTransferRate"]')).toHaveValue('10');
    await navigationRulesPanel.locator('[name="freightTransferRate"]').fill('10000');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.freightTransferRate).toBe(10000);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('i');
    await buy.locator('[name="item"]').selectOption('stone');
    await buy.locator('[name="quantity"]').fill('980');
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect.poll(() => me().boatHold?.stone).toBe(1000);
    await buy.locator('[name="quantity"]').fill('1');
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('full or unsuitable');
    const shop = () => current().buildings.find((b) => b.id === d.id)!;
    shop().stock.stone = 0;
    await expect(buy.locator('option[value="stone"]')).toContainText('0 in shop', {
      timeout: 5000,
    });
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Not enough stock');
    const sell = panel
      .locator('form[data-action="trade"]')
      .filter({ has: page.locator('input[name="direction"][value="sell"]') })
      .first();
    shop().investment = 0;
    await sell.locator('[name="item"]').selectOption('stone');
    await sell.getByRole('button', { name: 'Sell from hold', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('insufficient investment');
    shop().stock.stone = 17;
    await expect(buy.locator('option[value="stone"]')).toContainText('17 in shop', {
      timeout: 5000,
    });
    shop().investment = 3000000;
    await sell.locator('[name="quantity"]').fill('1000');
    await sell.getByRole('button', { name: 'Sell from hold', exact: true }).click();
    await expect.poll(() => me().boatHold?.stone).toBe(0);
    me().inventory.water = 1;
    await load.locator('[name="item"]').selectOption('water');
    await load.locator('[name="quantity"]').fill('1');
    await load.getByRole('button', { name: 'Load inventory', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('full or unsuitable');
    await buy.locator('[name="item"]').selectOption('fuel');
    await buy.locator('[name="quantity"]').fill('40');
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect.poll(() => me().boatHold?.fuel).toBe(40);
    await unload.locator('[name="item"]').selectOption('fuel');
    await unload.locator('[name="quantity"]').fill('40');
    await unload.getByRole('button', { name: 'Unload to inventory', exact: true }).click();
    await expect.poll(() => me().inventory.fuel).toBe(40);
    await page.getByRole('button', { name: 'Fill tank from carried Fuel', exact: true }).click();
    await expect.poll(() => me().fuel).toBe(320);
    await buy.locator('[name="item"]').selectOption('stone');
    await buy.locator('[name="quantity"]').fill('1000');
    await buy.getByRole('button', { name: 'Buy into hold', exact: true }).click();
    await expect.poll(() => me().boatHold?.stone).toBe(1000);
    await panel.locator('h3').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/cargo-boat/hold-panel.png' });
    await page.getByRole('button', { name: 'Disembark on foot', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(5);
    await page.keyboard.press('i');
    await expect(panel).toContainText('Moored');
    await page.getByRole('button', { name: 'Board your Coastal cargo boat', exact: true }).click();
    await expect.poll(() => me().vehicle).toBe(35);
    expect(me().boatHold?.stone).toBe(1000);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.keyboard.press('F4');
    await expect.poll(() => me().engine).toBe(true);
    await page.keyboard.down('w');
    await expect.poll(() => me().boatThrottle ?? 0).toBeGreaterThan(0.95);
    await page.keyboard.up('w');
    await expect
      .poll(() => Math.hypot(me().x - d.berth.x, me().z - d.berth.z), { timeout: 30000 })
      .toBeGreaterThan(80);
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(me().speed)).toBeLessThan(0.1);
    await page.keyboard.up('b');
    await page.keyboard.press('h');
    await page.mouse.move(720, 400);
    await page.mouse.wheel(0, 350);
    await page.mouse.down();
    await page.mouse.move(920, 400, { steps: 20 });
    await page.mouse.up();
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/cargo-boat-scale/coastal-after.png' });
    await page.keyboard.press('h');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    const editor = page.locator('[data-vehicle-editor]');
    await editor.locator('[name="slot"]').selectOption('35');
    await editor.getByText('Performance, fuel and economy', { exact: true }).click();
    for (const [name, value] of Object.entries({
      length: '48',
      beam: '12',
      draft: '2.5',
      freeboard: '2.8',
    }))
      await editor.locator(`[name="${name}"]`).fill(value);
    await editor.getByRole('button', { name: 'Save vehicle configuration', exact: true }).click();
    await expect.poll(() => current().vehicleTuning?.[35]?.draft).toBe(2.5);
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const navigation = page.getByRole('group', { name: 'Boat navigation', exact: true });
    for (const [name, value] of Object.entries({
      boatBerthSearchDistance: '12',
      quayMaxLength: '50',
      quayMaxBeam: '14',
    }))
      await navigationRulesPanel.locator(`[name="${name}"]`).fill(value);
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => current().settings.boatBerthSearchDistance).toBe(12);
    await page.screenshot({ path: 'output/cargo-boat-scale/creator-rules.png' });
    const invalid = navigationRulesPanel.locator('[name="boatBerthSearchDistance"]');
    await invalid.fill('-1');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    expect(await invalid.evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(
      true,
    );
    expect(current().settings.boatBerthSearchDistance).toBe(12);
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
    await editor.locator('[name="slot"]').selectOption('35');
    for (const [name, value] of Object.entries({
      length: '48',
      beam: '12',
      draft: '2.5',
      freeboard: '2.8',
    }))
      await expect(editor.locator(`[name="${name}"]`)).toHaveValue(value);
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(invalid).toHaveValue('12');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
