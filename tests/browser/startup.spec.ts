// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
test('cold entry waits for textures and GPU preparation, holds input neutral and tolerates a missing texture', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-startup-test-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Cold driver');
    const w = app.worlds.get('puddlewick')!,
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    p.x = 0;
    p.z = 0;
    await page.route('**/textures/*.webp', async (route) => {
      await gate;
      if (route.request().url().includes('stone.webp')) await route.abort();
      else await route.continue();
    });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#startup-loading')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#world-hud')).toBeHidden();
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(300);
    expect(p.speed).toBe(0);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
    release();
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await expect(page.locator('#startup-loading')).toBeHidden();
    await expect(page.locator('#toast')).toContainText('Plain surfaces');
    // A held key during loading must not become a delayed drive command.
    await page.waitForTimeout(300);
    expect(p.speed).toBe(0);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowUp');
    await expect.poll(() => Math.abs(p.speed)).toBeGreaterThan(0.1);
    await page.keyboard.up('ArrowUp');
    expect(
      await page.evaluate(() => performance.getEntriesByName('aclone-world-ready').length),
    ).toBe(1);
  } finally {
    release();
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
