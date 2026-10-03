// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';

test('drinks distort only scenery, preserve usable UI, respect reduced motion and fade sober', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-drunk-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Pub visitor');
    const w = app.worlds.get('puddlewick')!,
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    w.settings.time = 43200;
    w.settings.dayLength = 0;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    p.inventory = { beer: 1, wine: 4 };
    p.x = 0;
    p.z = 12;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    const canvas = page.locator('canvas[data-intoxication]');
    await expect(canvas).toHaveAttribute('data-intoxication', '0.000');
    await page.screenshot({ path: 'test-results/intoxication/sober.png' });
    await page.keyboard.press('i');
    await expect(page.getByText(/Alcohol: repeated drinks/).first()).toBeVisible();
    await page.locator('#modal-host [data-do=use][data-id=beer]').click();
    await expect.poll(() => p.inventory.beer).toBe(0);
    await expect(page.locator('#intoxication-status')).toBeHidden();
    for (let i = 0; i < 3; i++) {
      await page.locator('#modal-host [data-do=use][data-id=wine]').click();
      await expect.poll(() => p.inventory.wine).toBe(3 - i);
    }
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(page.locator('#intoxication-status')).toContainText('Very drunk');
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-intoxication')))
      .toBeGreaterThan(0.8);
    await page.screenshot({ path: 'test-results/intoxication/drunk.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#intoxication-status')).toBeVisible();
    const bounds = await page.locator('#intoxication-status').boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: 'test-results/intoxication/mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#chat-input').fill('Still readable while tipsy');
    await expect(page.locator('#chat-input')).toHaveValue('Still readable while tipsy');
    await page.locator('#chat-input').blur();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(canvas).toHaveAttribute('data-drunk-effects', 'reduced');
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Options & pilot key', exact: true }).click();
    await page.getByRole('button', { name: /Drunk visual effects:/ }).click();
    await page.getByRole('button', { name: /Drunk visual effects:/ }).click();
    await expect(canvas).toHaveAttribute('data-drunk-effects', 'off');
    await expect(canvas).toHaveAttribute('data-intoxication', '0.000');
    expect(p.alcohol!.level).toBeGreaterThan(90);
    await expect(page.locator('#intoxication-status')).toContainText('Very drunk');
    expect(await page.evaluate(() => localStorage.getItem('aclone.drunkEffects'))).toBe('off');
    await page.getByRole('button', { name: /Drunk visual effects:/ }).click();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    p.alcohol!.at = w.time - 1201;
    await expect(page.locator('#intoxication-status')).toBeHidden();
    await expect(canvas).toHaveAttribute('data-intoxication', '0.000');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
