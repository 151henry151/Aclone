// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('menu, wheel and pinch share the doubled tractor camera range', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-camera-zoom-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const { account, token } = app.universe.register('Camera pilot');
    const w = createWorld('camera-zoom', 'Camera zoom', account.id);
    w.script = '';
    w.settings.mapSize = 500;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    w.buildings = [];
    const p = addPlayer(w, account.id, account.name);
    p.engine = false;
    app.worlds.set(w.id, w);
    const port = await app.listen();
    // Observe the actual game camera without changing input or rendering behaviour.
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nglobalThis.__cameraUnderTest = scene;\n',
      });
    });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const zoom = () => page.evaluate(() => (globalThis as any).__cameraUnderTest.zoom as number);
    const actions = page.locator('[data-do="mobile-actions"]');
    await actions.click();
    const dialog = page.getByRole('dialog');
    for (let i = 0; i < 24; i++)
      await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
    expect(await zoom()).toBe(5.6);
    await page.keyboard.press('Escape');
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = (globalThis as any).__cameraUnderTest;
          return Math.abs(s.camera.position.z - s.me.z);
        }),
      )
      .toBeCloseTo(21 * 5.6, 0);
    await page.screenshot({ path: 'test-results/camera-zoom-tractor.png' });
    await actions.click();
    for (let i = 0; i < 24; i++)
      await dialog.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect(await zoom()).toBe(0.55);
    await page.keyboard.press('Escape');
    const canvas = page.locator('#viewport canvas');
    await canvas.dispatchEvent('wheel', { deltaY: 10000 });
    expect(await zoom()).toBe(5.6);
    await canvas.dispatchEvent('wheel', { deltaY: -10000 });
    expect(await zoom()).toBe(0.55);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: 40, y: 300, id: 1 },
        { x: 350, y: 300, id: 2 },
      ],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: 180, y: 300, id: 1 },
        { x: 210, y: 300, id: 2 },
      ],
    });
    expect(await zoom()).toBe(5.6);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await actions.click();
    await dialog.locator('[data-do="walk"]').click();
    await expect.poll(() => p.vehicle).toBe(5);
    await actions.click();
    for (let i = 0; i < 24; i++)
      await dialog.getByRole('button', { name: 'Zoom out', exact: true }).click();
    expect(await zoom()).toBe(2.8);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
