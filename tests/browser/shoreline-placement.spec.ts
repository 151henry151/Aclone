// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../../src/server/puddlewick-boatyard';
import { terrainHeight } from '../../src/shared/terrain';
import { creatorSchema } from '../../src/shared/creator';
import { prepareWaterSources } from '../../src/shared/springs';
import { waitForWorld } from './fixtures/ready';

test('shoreline plan explains and shows water, jetty and intake before authoritative construction', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-shoreline-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  mkdirSync('output/shoreline-audit', { recursive: true });
  try {
    const { account, token } = app.universe.register('ShoreBuilder');
    const w = createWorld('puddlewick', 'Shoreline test world', account.id);
    ensurePuddlewickBoatyard(w);
    const yard = w.buildings.find((b) => b.id === 'parish-boatyard')!;
    expect(yard).toBeTruthy();
    w.buildings = [];
    w.towns = [];
    w.zones = [];
    w.roads = [];
    w.script = '';
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    Object.assign(w.settings, {
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
      solidScenery: 'off',
      constructionOwnerSlopeBypass: false,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: yard.x,
      z: yard.z,
      y: terrainHeight(w, yard.x, yard.z),
      vehicle: 5,
      cash: 100000000,
    });
    app.worlds.set(w.id, w);
    const port = await app.listen();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'puddlewick');
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
    const kind = page.getByLabel('Building type', { exact: true });
    const bearing = page.getByLabel('Building rotation', { exact: true });
    const place = page.getByRole('button', { name: 'Place foundation', exact: true });
    await open();
    await kind.selectOption('boathouse');
    await expect(page.locator('[data-waterfront-help]')).toContainText('jetty');
    await expect(place).toBeDisabled();
    await expect(bearing).toHaveAttribute('step', '1');
    await bearing.fill('179');
    await expect(page.locator('[data-bearing]')).toHaveText('179°');
    await bearing.fill('180');
    await expect(place).toBeEnabled();
    await expect(page.locator('[data-waterfront-help]')).toContainText('water to the south');
    const waterPixels = await page
      .locator('[data-build-site]')
      .evaluate((el: HTMLCanvasElement) => {
        const pixels = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 44 && pixels[i + 1] === 103 && pixels[i + 2] === 132) count++;
        return count;
      });
    expect(waterPixels).toBeGreaterThan(1000);
    await page.locator('[data-waterfront-help]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/shoreline-audit/boathouse.png' });
    await kind.selectOption('pumpHouse');
    await expect(place).toBeDisabled();
    await expect(page.locator('[data-waterfront-help]')).toContainText('desalination');
    expect(w.buildings).toHaveLength(0);
    await kind.selectOption('boathouse');
    await place.click();
    await expect.poll(() => w.buildings.length).toBe(1);
    expect(w.buildings[0].kind).toBe('boathouse');
    expect(w.buildings[0].rotation).toBe(Math.PI);
    await page.keyboard.press('Escape');
    // A separate disposable fresh-water fixture, with no changes to live terrain.
    w.buildings = [];
    w.terrainMapSize = 500;
    Object.assign(w.settings, { mapSize: 500, seaLevel: -2, tidalRange: 0 });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(30),
    };
    w.springs = [{ id: 'test-spring', x: 100, z: 100, flow: 1 }];
    prepareWaterSources(w);
    Object.assign(p, { x: 101, z: 108, y: 30, speed: 0 });
    w.revision++;
    await page.setViewportSize({ width: 430, height: 932 });
    await page.reload();
    await waitForWorld(page);
    await open();
    await kind.selectOption('boathouse');
    await expect(place).toBeDisabled(); // Inland boathouse, even though a spring is nearby.
    const cash = p.cash;
    await kind.selectOption('pumpHouse');
    await bearing.fill('0');
    await expect(page.locator('[data-waterfront-help]')).toContainText('Spring intake connected');
    await expect(place).toBeEnabled();
    await page.locator('[data-build-site]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/shoreline-audit/pump-phone.png' });
    expect(p.cash).toBe(cash);
    await place.click();
    await expect.poll(() => w.buildings.length).toBe(1);
    expect(w.buildings[0].waterSource?.spring).toBe('test-spring');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
