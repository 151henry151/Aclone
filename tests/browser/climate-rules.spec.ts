// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { weatherAt } from '../../src/shared/environment';
import { defaults } from '../../src/shared/catalog';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('Climate editor changes visible winter weather, persists rates and rejects inverted bounds', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-climate-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Climate builder'),
      initial = createWorld('climate-preview', 'Winter workshop', account.id);
    initial.script = '';
    initial.buildings = [];
    initial.towns = [];
    initial.roads = [];
    initial.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(3),
    };
    initial.creator = creatorSchema.parse({ weather: 'natural', roads: false, scenery: false });
    Object.assign(initial.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
    });
    const day = Array.from({ length: 59 }, (_, i) => 365 + i).find((day) => {
      const c = weatherAt(initial.id, day, 0.5);
      return c.precipitation === 'snow' && c.clouds < 1;
    })!;
    expect(day).toBeDefined();
    initial.time = (day + 0.5 - 59 - defaults.time / 86400) * 600;
    Object.assign(addPlayer(initial, account.id, account.name), {
      x: 0,
      z: 0,
      y: 3,
      vehicle: 5,
      speed: 0,
      engine: false,
    });
    app.worlds.set(initial.id, initial);
    const w = () => app.worlds.get(initial.id)!;
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
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click(),
      apply = () =>
        page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    const group = page.getByRole('group', { name: 'Climate', exact: true });
    await edit();
    await expect(group.locator('[name="climateSpringWetChance"]')).toHaveValue('0.64');
    const keys = [
      'climateSpringWetChance',
      'climateSummerWetChance',
      'climateAutumnWetChance',
      'climateWinterWetMin',
      'climateWinterWetMax',
    ];
    for (const k of keys) await group.locator(`[name="${k}"]`).fill('0');
    await group.locator('[name="climateForcedSnowstorm"]').fill('0.8');
    await apply();
    await expect.poll(() => (w().settings as any).climateWinterWetMax).toBe(0);
    await close();
    await expect(page.locator('#clock')).toContainText(/clear|overcast/);
    await expect(page.locator('#clock')).not.toContainText('snow');
    mkdirSync('output/climate-rules/browser', { recursive: true });
    await page.screenshot({ path: 'output/climate-rules/browser/clear.png' });
    await edit();
    for (const k of keys) await group.locator(`[name="${k}"]`).fill('1');
    await apply();
    await close();
    await expect(page.locator('#clock')).toContainText('snow');
    await page.screenshot({ path: 'output/climate-rules/browser/snowfall.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    for (const k of keys) await expect(group.locator(`[name="${k}"]`)).toHaveValue('1');
    await expect(group.locator('[name="climateForcedSnowstorm"]')).toHaveValue('0.8');
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/climate-rules/browser/settings.png' });
    await group.locator('[name="climateWinterWetMin"]').fill('0.9');
    await group.locator('[name="climateWinterWetMax"]').fill('0.1');
    await apply();
    await expect(page.locator('#toast')).toContainText(/winter/i);
    expect((w().settings as any).climateWinterWetMin).toBe(1);
    expect((w().settings as any).climateWinterWetMax).toBe(1);
    await group.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/climate-rules/browser/invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="climateWinterWetMin"]')).toHaveValue('1');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
