// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('fishing wait rules persist with real casting empty catch invalid settings and disabled fishing', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-waits-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Angler'),
      initial = createWorld('waits', 'Fishing waits', account.id);
    initial.script = '';
    initial.buildings = [];
    initial.towns = [];
    initial.roads = [];
    initial.zones = [];
    initial.resources = {};
    Object.assign(initial.settings, {
      mapSize: 1000,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      fishingMode: 5,
    });
    initial.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 80,
      z: 80,
      y: 0,
      vehicle: 5,
      engine: false,
      speed: 0,
      inventory: { tackle: 1 },
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
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      edit = async () => {
        await page.keyboard.press('F10');
        await page.getByRole('button', { name: 'Rules', exact: true }).click();
      },
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const group = page.getByRole('group', { name: 'Fishing rules', exact: true }),
      patch = {
        fishingShoreWaitSeconds: 11,
        fishingAnywhereWaitSeconds: 7,
        fishingCoastalWaitSeconds: 13,
        fishingDeepWaitSeconds: 17,
      };
    await edit();
    for (const [k, v] of Object.entries(patch))
      await group.locator(`[name="${k}"]`).fill(String(v));
    await apply();
    await expect.poll(() => w().settings.fishingAnywhereWaitSeconds).toBe(7);
    await close();
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const [k, v] of Object.entries(patch))
      await expect(group.locator(`[name="${k}"]`)).toHaveValue(String(v));
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-wait-rules.png' });
    await close();
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    const card = page
      .getByRole('dialog')
      .locator('article')
      .filter({ has: page.getByRole('heading', { name: 'Fishing', exact: true }) });
    await expect(card).toContainText('Base mean wait here: 7 seconds');
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-wait-help.png' });
    await page.getByRole('button', { name: 'Cast a line', exact: true }).click();
    await expect(page.locator('#fishing-status')).toHaveText('Waiting for a bite…');
    await expect(page.locator('#fishing-reel')).toBeDisabled();
    expect(p().fishAt).toBeGreaterThan(w().time);
    expect(p().inventory.fish ?? 0).toBe(0);
    await page.screenshot({ path: 'test-results/fishing-wait-empty.png' });
    const scheduled = [p().fishAt, p().fishUntil, p().fishCatch];
    await edit();
    const invalid = group.locator('[name="fishingAnywhereWaitSeconds"]');
    await invalid.fill('0');
    await apply();
    await expect(invalid).toBeFocused();
    expect(await invalid.evaluate((i: HTMLInputElement) => i.validity.rangeUnderflow)).toBe(true);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-wait-invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(invalid).toHaveValue('7');
    expect([p().fishAt, p().fishUntil, p().fishCatch]).toEqual(scheduled);
    await close();
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await page.getByRole('button', { name: 'Leave current activity', exact: true }).click();
    await close();
    await edit();
    await page.locator('[name="fishingMode"]').fill('0');
    await apply();
    await expect.poll(() => w().settings.fishingMode).toBe(0);
    await close();
    await page.getByRole('button', { name: 'Activities', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cast a line', exact: true })).toHaveCount(0);
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/fishing-wait-disabled.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
