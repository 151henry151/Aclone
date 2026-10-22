// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
import { waitForWorld } from './fixtures/ready';

test('snow accumulates visually without obscuring roads or adding ground draw calls', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-snow-visual-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    const port = await app.listen();
    await page.route('**/__snow_test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<script>window.__ACLONE_BASE__=""</script><script type="module" src="/tests/browser/fixtures/snow-roads.ts"></script>',
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__snow_test`);
    await page.waitForFunction(() => typeof (window as any).renderSnow === 'function');
    const render = (depth: number) => page.evaluate((d) => (window as any).renderSnow(d), depth);
    const bare = await render(0);
    const dust = await render(0.01);
    const base = await render(0.04);
    const deep = await render(0.2);
    for (const result of [dust, base, deep]) {
      expect(result.road).toEqual(bare.road);
      expect(result.calls).toBe(1);
    }
    expect(dust.field[0]).toBeGreaterThan(bare.field[0]);
    expect(base.field[0]).toBeGreaterThan(dust.field[0]);
    expect(deep.field[0]).toBeGreaterThan(bare.field[0] + 20);
    await page.screenshot({ path: 'test-results/snow-clear-roads.png' });
    const closeups = [];
    for (const depth of [0, 0.04, 0.15, 0.25]) {
      closeups.push(await page.evaluate((d) => (window as any).snowCloseup(d), depth));
      await page.screenshot({ path: `test-results/snow-depth-${Math.round(depth * 100)}cm.png` });
    }
    expect(closeups[1].plants).toBeGreaterThan(5);
    expect(closeups[2].plants).toBeLessThan(closeups[1].plants);
    const tracks = await page.evaluate(() => (window as any).snowTracks(0.11));
    expect(tracks.marks).toBeGreaterThan(5);
    expect(tracks.calls).toBe(closeups.at(-1).calls + 1);
    await page.screenshot({ path: 'test-results/snow-ruts-11cm.png' });
    await page.evaluate(() => (window as any).snowTracks(0));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live snowy town reports depth, keeps roads visible and handles clear winter before snowfall', async ({
  page,
}) => {
  test.setTimeout(270000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-snow-town-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    const { account, token } = app.universe.register('Winter driver');
    const w = createWorld('winter-preview', 'Winter preview', account.id);
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.time = (375 - 59) * 600;
    w.creator = creatorSchema.parse({ weather: 'clear' });
    const p = addPlayer(w, account.id, account.name);
    p.x = 55;
    p.z = 30;
    p.heading = 0;
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
    await waitForWorld(page);
    await expect(page.locator('#clock')).toContainText('Winter');
    await expect(page.locator('#clock')).not.toContainText('cm');
    w.climate = { snow: 1, snowDepth: 0.04, winterBase: 0.04, wetness: 1, snowModel: 1 };
    await expect(page.locator('#clock')).toContainText('Snow 4 cm · roads clear');
    await page.screenshot({ path: 'test-results/winter-base-snow.png' });
    w.climate.snowDepth = 0.11;
    await expect(page.locator('#clock')).toContainText('Snow 11 cm');
    const startZ = p.z;
    await page.keyboard.down('ArrowUp');
    await expect.poll(() => p.z - startZ, { timeout: 60000 }).toBeGreaterThan(14);
    await page.keyboard.up('ArrowUp');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.2);
    w.climate.snowDepth = 0.11;
    await expect(page.locator('#clock')).toContainText('Snow 11 cm');
    await page.screenshot({ path: 'test-results/snow-ruts-town-11cm.png' });
    // Orbit using the actual camera gesture to inspect the track walls from the side.
    await page.mouse.move(720, 420);
    await page.mouse.down();
    await page.mouse.move(920, 420, { steps: 12 });
    await page.mouse.up();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let frames = 0;
          const next = () => {
            if (++frames >= 6) resolve();
            else requestAnimationFrame(next);
          };
          requestAnimationFrame(next);
        }),
    );
    await page.screenshot({ path: 'test-results/snow-ruts-town-side-11cm.png' });
    // Inspect real cottage roofs, fence caps and roadside banks from the normal camera.
    p.x = -68;
    p.z = 122;
    p.heading = Math.atan2(-10, -14);
    await page.mouse.move(920, 420);
    await page.mouse.down();
    await page.mouse.move(720, 420, { steps: 12 });
    await page.mouse.up();
    await page.mouse.move(720, 420);
    await page.mouse.down();
    await page.mouse.move(720, 520, { steps: 8 });
    await page.mouse.up();
    for (const depth of [0.04, 0.11, 0.25]) {
      w.climate.snowDepth = depth;
      await expect(page.locator('#clock')).toContainText(`${Math.round(depth * 100)} cm`);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let n = 0;
            const frame = () => {
              if (++n >= 8) resolve();
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
      );
      await page.screenshot({ path: `test-results/snow-cottage-${Math.round(depth * 100)}cm.png` });
    }
    w.settings.time = 0; // depth remains fixed for the HUD assertion
    w.climate.snowDepth = 1.2;
    await expect(page.locator('#clock')).toContainText('Deep snow 1.2 m · roads clear');
    w.creator!.weather = 'snowstorm';
    w.settings.time = 43200;
    await expect(page.locator('#clock')).toContainText('STORM');
    await page.screenshot({ path: 'test-results/winter-snowstorm.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
