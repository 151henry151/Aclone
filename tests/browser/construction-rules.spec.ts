// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, act, money } from '../../src/shared/simulation';
import { constructionRefund } from '../../src/shared/construction';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('construction rules persist, govern visible placement and quote custom and zero refunds', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-construction-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Builder'),
      initial = createWorld('construction-rules', 'Construction', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.resources = {};
    initial.zones = [];
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
    const neighbour = makeBuilding('neighbour', 'home', 60, 80);
    neighbour.creatorBounds = { width: 2, depth: 2, height: 2 };
    initial.buildings = [neighbour];
    const player = addPlayer(initial, account.id, account.name);
    Object.assign(player, {
      x: 80,
      z: 80,
      y: 0,
      heading: 0,
      vehicle: 5,
      engine: false,
      cash: 1000000,
      inventory: {},
      fuel: 64,
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
    const build = async () => {
      await page.locator('[data-do="construction"]:visible').click();
      await page.getByLabel('Building type', { exact: true }).selectOption('home');
    };
    const place = page.getByRole('button', { name: 'Place foundation', exact: true });
    await build();
    await expect(place).toBeEnabled();
    await close();
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const group = page.getByRole('group', { name: 'Construction rules', exact: true });
    const apply = () =>
      page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const patch = {
      constructionMinimumSpacing: 25,
      constructionPlacementReach: 6,
      spawnClearance: 18,
      townCentreClearance: 9,
      constructionRefundShare: 0.29,
    };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.constructionMinimumSpacing).toBe(25);
    await close();
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/construction-rules.png' });
    await close();
    await build();
    await expect(page.getByRole('dialog')).toContainText('29% of its base cash cost');
    await expect(page.locator('[data-build-estimate]')).toContainText(
      'Too close to another building',
    );
    await expect(place).toBeDisabled();
    await page.locator('[data-build-estimate]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/construction-spacing-refused.png' });
    await close();
    await page.keyboard.down('w');
    try {
      await expect.poll(() => p().z, { intervals: [100] }).toBeGreaterThan(102);
    } finally {
      await page.keyboard.up('w');
    }
    await build();
    await expect(place).toBeEnabled();
    await place.click();
    await expect.poll(() => w().buildings.length).toBe(2);
    const b = w().buildings.find((b) => b.construction)!,
      cash = p().cash,
      refund = constructionRefund(w(), b);
    expect(refund).toBe(Math.floor(b.constructionCost! * 0.29));
    // Stand at the entrance in this local fixture to inspect the ordinary building panel.
    Object.assign(p(), { x: b.x, z: b.z + 13, heading: Math.PI, speed: 0 });
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target button').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('summary', { hasText: 'Cancel construction' }).click();
    await expect(dialog).toContainText(`Receive ${money(refund)} back (29% of the base cash cost)`);
    await page.screenshot({ path: 'test-results/construction-refund.png' });
    await dialog.getByRole('button', { name: 'Cancel building and receive refund' }).click();
    await expect.poll(() => w().buildings.length).toBe(1);
    expect(p().cash).toBe(cash + refund);
    await expect(dialog).toHaveCount(0);
    assertNoSecondCancel();
    function assertNoSecondCancel() {
      const before = p().cash;
      expect(() => act(w(), p().id, { type: 'cancelConstruction', building: b.id })).toThrow();
      expect(p().cash).toBe(before);
    }
    await edit();
    await group.locator('[name="constructionRefundShare"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.constructionRefundShare).toBe(0);
    const invalid = group.locator('[name="constructionRefundShare"]');
    await invalid.fill('1.01');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeOverflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/construction-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="constructionRefundShare"]')).toHaveValue('0');
    await close();
    await build();
    await expect(dialog).toContainText('0% of its base cash cost');
    await expect(place).toBeEnabled();
    await place.click();
    await expect.poll(() => w().buildings.length).toBe(2);
    const zero = w().buildings.find((b) => b.construction)!,
      beforeZero = p().cash;
    Object.assign(p(), { x: zero.x, z: zero.z + 13, heading: Math.PI, speed: 0 });
    await page.reload();
    await waitForWorld(page);
    await page.locator('#target button').click();
    await dialog.locator('summary', { hasText: 'Cancel construction' }).click();
    await expect(dialog).toContainText(`Receive ${money(0)} back (0% of the base cash cost)`);
    await page.screenshot({ path: 'test-results/construction-zero-refund.png' });
    await dialog.getByRole('button', { name: 'Cancel building and receive refund' }).click();
    await expect.poll(() => w().buildings.length).toBe(1);
    expect(p().cash).toBe(beforeZero);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
