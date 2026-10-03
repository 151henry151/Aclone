// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
test('mobile landscape editor draws paths, paints ground, previews a heightmap and undoes changes', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-landscape-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Landscape maker'),
      w = app.worlds.get('puddlewick')!;
    w.owner = account.id;
    const p = addPlayer(w, account.id, account.name);
    p.authority = 20;
    app.store.saveWorld(w);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Landscape', exact: true }).click();
    await page.getByLabel('Map points').fill('-80,-190; -30,-170; 40,-190');
    await page.getByLabel('Map points').blur();
    await page.getByRole('button', { name: 'Add path or barrier' }).click();
    await expect.poll(() => w.landscape?.paths.length).toBe(1);
    await page.getByLabel('Map points').fill('-12,30; 12,30');
    await page.getByLabel('Map points').blur();
    const line = page.locator('#landscape-line-form');
    await line.getByRole('combobox', { name: 'Feature' }).selectOption('fence');
    await line.getByLabel('Width in metres').fill('0.3');
    await line.getByRole('button', { name: 'Add path or barrier' }).click();
    await expect.poll(() => w.landscape?.barriers.length).toBe(1);
    const surface = page.locator('#landscape-surface-form');
    await surface.getByRole('combobox', { name: 'Surface', exact: true }).selectOption('soil');
    await surface.getByRole('button', { name: 'Paint surface' }).click();
    await expect.poll(() => w.landscape?.surfaces.length).toBe(1);
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 33;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#888';
      ctx.fillRect(0, 0, 33, 33);
      return c.toDataURL().split(',')[1];
    });
    const map = page.locator('#landscape-heightmap-form');
    await map.getByLabel('Heightmap image').setInputFiles({
      name: 'hills.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    await map.getByRole('button', { name: 'Preview heightmap', exact: true }).click();
    await expect(map.getByRole('status')).toContainText('Preview ready');
    expect(w.landscape?.heightmap).toBeUndefined();
    await map.getByRole('button', { name: 'Apply previewed heightmap' }).click();
    await expect.poll(() => w.landscape?.heightmap?.length).toBe(1089);
    await expect(page.getByRole('button', { name: 'Restore procedural terrain' })).toBeVisible();
    await page.getByRole('button', { name: 'Undo last landscape edit' }).click();
    await expect.poll(() => w.landscape?.heightmap).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Restore procedural terrain' })).toHaveCount(0);
    await page.locator('#landscape-map').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/landscape-editor-mobile.png' });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'test-results/landscape-ground.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
