// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { celestialAt } from '../../src/shared/astronomy';
import { waterLevel } from '../../src/shared/ocean';
import { defaults } from '../../src/shared/catalog';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
test('Lunar rules change rendered moonlight and tides, persist, and reject zero', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-lunar-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Lunar builder'),
      initial = createWorld('lunar-preview', 'Moonlit workshop', account.id);
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
    initial.creator = creatorSchema.parse({ weather: 'clear', roads: false, scenery: false });
    Object.assign(initial.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 0,
      tidalRange: 2,
      hungerRate: 0,
      thirstRate: 0,
    });
    initial.time = (373 - 59 - defaults.time / 86400) * 600;
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
    await page.route('**/src/client/main.ts*', async (route) => {
      const response = await route.fetch();
      const observer = `import {GameScene as AuditScene} from '/src/client/scene.ts';const oldSet=AuditScene.prototype.setWorld;AuditScene.prototype.setWorld=function(...args){globalThis.__lunarScene=this;return oldSet.apply(this,args)};\n`;
      await route.fulfill({ response, body: observer + (await response.text()) });
    });
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
    const group = page.getByRole('group', { name: 'Calendar', exact: true });
    const rendered = () =>
      page.evaluate(() => {
        const s = (window as any).__lunarScene;
        const u = s.sky.material.uniforms;
        return {
          moon: u.moonA.value.toArray(),
          glow: u.moonGlow.value,
          skyTime: u.twinkle.value,
          seaTime: s.ocean.time.value,
          level: s.ocean.level.value,
        };
      });
    const check = async (period: number) => {
      const r = await rendered(),
        date = r.skyTime / 600 + 59 + defaults.time / 86400,
        expected = celestialAt(date, 0, { calendarLunarDays: period });
      for (let i = 0; i < 3; i++)
        expect(Math.abs(r.moon[i] - expected.moons[0].direction[i])).toBeLessThan(1e-10);
      expect(
        Math.abs(
          r.level -
            waterLevel(
              { ...w(), settings: { ...w().settings, calendarLunarDays: period } },
              r.seaTime,
            ),
        ),
      ).toBeLessThan(1e-10);
    };
    await edit();
    await expect(group.locator('[name="calendarLunarDays"]')).toHaveValue('28');
    await close();
    await expect.poll(async () => (await rendered()).glow).toBeGreaterThan(1);
    await check(28);
    mkdirSync('output/lunar-rules/browser', { recursive: true });
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/lunar-rules/browser/full-moon.png' });
    await edit();
    await group.locator('[name="calendarLunarDays"]').fill('14');
    await apply();
    await expect.poll(() => (w().settings as any).calendarLunarDays).toBe(14);
    await close();
    await expect.poll(async () => (await rendered()).glow).toBeLessThan(0.01);
    await check(14);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/lunar-rules/browser/dark-night.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="calendarLunarDays"]')).toHaveValue('14');
    await group.locator('[name="calendarLunarDays"]').fill('0');
    await apply();
    expect(
      await group
        .locator('[name="calendarLunarDays"]')
        .evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow),
    ).toBe(true);
    expect((w().settings as any).calendarLunarDays).toBe(14);
    await page.screenshot({ path: 'output/lunar-rules/browser/invalid.png' });
    await page.reload();
    await waitForWorld(page);
    await edit();
    await expect(group.locator('[name="calendarLunarDays"]')).toHaveValue('14');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
