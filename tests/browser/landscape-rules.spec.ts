// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, act } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { landscapeRuleCeilings } from '../../src/shared/landscape-rules';
import { waitForWorld } from './fixtures/ready';
test('landscape capacity controls preserve work and render a world at the supported ceilings', async ({
  page,
}) => {
  test.setTimeout(360000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-landscape-rules-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Landscape builder'),
      initial = createWorld('landscape-workshop', 'Landscape workshop', account.id);
    initial.script = '';
    initial.towns = [];
    initial.roads = [];
    initial.buildings = [];
    initial.terrain = [];
    initial.landscape = {
      paths: [],
      barriers: [],
      scatter: [],
      surfaces: [],
      heightmap: Array(1089).fill(8),
    };
    initial.creator = creatorSchema.parse({ weather: 'clear', roads: false, scenery: false });
    Object.assign(initial.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
    });
    Object.assign(addPlayer(initial, account.id, account.name), { vehicle: 0, engine: false });
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
    const frames = () =>
      page.evaluate(
        () =>
          new Promise<number[]>((resolve) => {
            const result: number[] = [];
            let previous = performance.now();
            const sample = (now: number) => {
              result.push(now - previous);
              previous = now;
              if (result.length === 12) resolve(result.slice(2));
              else requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          }),
      );
    const baseline = await frames();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Landscape', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Scatter models', exact: true })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Undo last landscape edit', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const group = page.getByRole('group', { name: 'Landscape limits', exact: true });
    await expect(group.locator('[name="terrainStampLimit"]')).toHaveValue('256');
    for (const [key, value] of Object.entries(landscapeRuleCeilings))
      await group.locator(`[name="${key}"]`).fill(String(value));
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w().settings.terrainStampLimit).toBe(512);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    // Populate only this disposable world through authoritative edits, then exercise the next UI edits.
    w().creator = creatorSchema.parse({
      ...w().creator,
      models: [
        {
          id: 'rock',
          name: 'Garden rock',
          parts: [{ shape: 'sphere', color: '#6c8056', sx: 1, sy: 1, sz: 1 }],
        },
      ],
    });
    const line = (i: number) => ({
      id: 'line' + i,
      points: Array.from({ length: 4 }, (_, j) => ({ x: -220 + j * 25, z: -200 + i * 3 })),
      width: 1,
      curved: false,
    });
    act(w(), account.id, {
      type: 'landscape',
      landscape: {
        heightmap: Array(1089).fill(8),
        paths: Array.from({ length: 64 }, (_, i) => line(i)),
        barriers: Array.from({ length: 64 }, (_, i) => ({
          ...line(i + 64),
          kind: 'fence',
          height: 1,
          width: 0.2,
        })),
        surfaces: Array.from({ length: 255 }, (_, i) => ({
          id: 'surface' + i,
          x: 30 + (i % 16) * 10,
          z: -150 + Math.floor(i / 16) * 10,
          radius: 2,
          material: 'sand',
        })),
        scatter: Array.from({ length: 64 }, (_, i) => ({
          id: 'rock' + i,
          model: 'rock',
          x: (i % 8) * 45 - 155,
          z: Math.floor(i / 8) * 45 - 155,
          radius: 18,
          count: 8,
          seed: i,
          solid: true,
        })),
      },
    });
    for (let i = 0; i < 511; i++)
      act(w(), account.id, {
        type: 'terrain',
        x: -200 + (i % 32) * 10,
        z: -170 + Math.floor(i / 32) * 10,
        radius: 1,
        height: 0.2,
      });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Landscape', exact: true }).click();
    const surface = page.locator('#landscape-surface-form');
    await surface.getByLabel('Centre X').fill('0');
    await surface.getByLabel('Centre Z').fill('0');
    await surface.getByLabel('Radius').fill('10');
    await surface.getByRole('combobox', { name: 'Surface', exact: true }).selectOption('gravel');
    await surface.getByRole('button', { name: 'Paint surface', exact: true }).click();
    await expect.poll(() => w().landscape!.surfaces.length).toBe(256);
    await expect(page.getByText(/256\/256 surfaces/)).toBeVisible();
    await expect(surface.getByLabel('Centre Z')).toHaveValue('0');
    await surface.getByLabel('Centre X').focus();
    await surface.getByRole('button', { name: 'Paint surface', exact: true }).click();
    await expect(page.locator('#landscape-feedback')).toContainText('256');
    expect(w().landscape!.surfaces.length).toBe(256);
    await page.getByRole('button', { name: 'Undo last landscape edit', exact: true }).click();
    await expect.poll(() => w().landscape!.surfaces.length).toBe(255);
    await surface.getByLabel('Centre X').fill('0');
    await surface.getByLabel('Centre Z').fill('0');
    await surface.getByLabel('Radius').fill('10');
    await surface.getByRole('combobox', { name: 'Surface', exact: true }).selectOption('gravel');
    await surface.getByRole('button', { name: 'Paint surface', exact: true }).click();
    await expect.poll(() => w().landscape!.surfaces.length).toBe(256);
    const brush = page.locator('form[data-action="terrain"]');
    await brush.getByLabel('X', { exact: true }).fill('20');
    await brush.getByLabel('Z', { exact: true }).fill('0');
    await brush.getByLabel('Brush radius').fill('8');
    await brush.getByLabel('Height change').fill('2');
    await brush.getByRole('button', { name: 'Apply terrain brush', exact: true }).click();
    await expect.poll(() => w().terrain.length).toBe(512);
    await brush.getByRole('button', { name: 'Apply terrain brush', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Terrain stamp limit reached (512)');
    expect(w().terrain.length).toBe(512);
    mkdirSync('output/landscape-rules/browser', { recursive: true });
    await page.locator('#landscape-map').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/landscape-rules/browser/preview.png' });
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await group.locator('[name="landscapeSurfaceLimit"]').fill('64');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('existing saved content');
    expect(w().settings.landscapeSurfaceLimit).toBe(256);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.reload();
    await waitForWorld(page);
    expect(w().terrain.length).toBe(512);
    expect(w().landscape!.surfaces.length).toBe(256);
    const loaded = await frames();
    const median = (v: number[]) => v.toSorted((a, b) => a - b)[Math.floor(v.length / 2)];
    writeFileSync(
      'output/landscape-rules/browser/timing.json',
      JSON.stringify(
        { baseline, loaded, baselineMedian: median(baseline), loadedMedian: median(loaded) },
        null,
        2,
      ),
    );
    expect(median(loaded)).toBeLessThan(Math.max(2000, median(baseline) * 3));
    await page.screenshot({ path: 'output/landscape-rules/browser/world.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(group.locator('[name="landscapeSurfaceLimit"]')).toHaveValue('256');
    await expect(group.locator('[name="terrainStampLimit"]')).toHaveValue('512');
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
