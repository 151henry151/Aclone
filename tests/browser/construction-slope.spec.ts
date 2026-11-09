// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';

test('construction slope survey shows cut/fill and refusals; owner rules and phone preview agree', async ({
  page,
}) => {
  test.setTimeout(120000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-slope-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('SlopeBuilder');
    const w = createWorld('slope-browser', 'Hillside survey', account.id);
    w.buildings = [];
    w.towns = [];
    w.zones = [];
    w.roads = [];
    w.resources = {};
    w.script = '';
    w.airfield = undefined;
    w.spaceportSite = undefined;
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -40,
      solidScenery: 'off',
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      constructionOwnerSlopeBypass: false,
    });
    const slope = (grade: number) => {
      w.landscape = {
        paths: [],
        surfaces: [],
        barriers: [],
        scatter: [],
        heightmap: Array.from({ length: 1089 }, (_, i) =>
          Math.max(-39, Math.min(39, 10 + grade * (((i % 33) / 32) * 500 - 330))),
        ),
      };
      w.revision++;
    };
    slope(0.25);
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 80,
      z: 60,
      y: terrainHeight(w, 80, 60),
      vehicle: 5,
      engine: false,
      cash: 1000000,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen(),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'slope-browser');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const open = async () => {
      if (page.viewportSize()!.width < 600)
        await page.locator('.mobile-nav [data-do="mobile-actions"]').click();
      await page.locator('[data-do="construction"]:visible').click();
    };
    const close = () => page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    const place = page.getByRole('button', { name: 'Place foundation', exact: true });
    await open();
    await expect(page.locator('[data-build-estimate]')).toContainText(/Ground rises.*25%/);
    await expect(place).toBeDisabled();
    await expect(page.getByText('Cut (orange) · Fill (blue)', { exact: false })).toBeVisible();
    const pixels = await page.locator('[data-build-site]').evaluate((el: HTMLCanvasElement) => {
      const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      let cut = 0,
        fill = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > data[i + 2] * 1.5 && data[i] > 150) cut++;
        if (data[i + 2] > data[i] * 1.4 && data[i + 2] > 120) fill++;
      }
      return { cut, fill };
    });
    expect(pixels.cut).toBeGreaterThan(500);
    expect(pixels.fill).toBeGreaterThan(500);
    await page.locator('[data-build-site]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/construction-slope/steep-site.png' });
    await close();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Construction rules', exact: true });
    await group.locator('[name="constructionMaximumGrade"]').fill('30');
    await group.locator('[name="constructionOwnerSlopeBypass"]').check();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.constructionOwnerSlopeBypass).toBe(true);
    await close();
    await open();
    await expect(place).toBeEnabled();
    await expect(page.locator('[data-build-estimate]')).toContainText('Owner slope bypass');
    await close();
    await page.reload();
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="constructionMaximumGrade"]')).toHaveValue('30');
    await expect(group.locator('[name="constructionOwnerSlopeBypass"]')).toBeChecked();
    await group.locator('[name="constructionMaximumGrade"]').fill('12');
    await group.locator('[name="constructionOwnerSlopeBypass"]').uncheck();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.constructionOwnerSlopeBypass).toBe(false);
    await close();
    slope(0.05);
    await page.reload();
    await waitForWorld(page);
    await open();
    await expect(place).toBeEnabled();
    await place.click();
    await expect.poll(() => w.buildings.length).toBe(1);
    const level = w.buildings[0].foundationY;
    // Only the local disposable fixture changes terrain; existing datum must survive.
    slope(0);
    Object.assign(p, { x: 130, z: 60, y: 10, speed: 0 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await waitForWorld(page);
    await open();
    await expect(place).toBeEnabled();
    await expect(page.locator('[data-build-estimate]')).toContainText('Ground variation 0.00 m');
    await expect(page.locator('[data-build-estimate]')).toContainText('No cut or fill needed');
    expect(w.buildings[0].foundationY).toBe(level);
    await page.locator('[data-build-site]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/construction-slope/level-phone.png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
