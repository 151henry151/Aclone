// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { terrainHeight } from '../../src/shared/terrain';
import { creatorSchema } from '../../src/shared/creator.ts';
import { buildingDesignQuote } from '../../src/shared/building-designs.ts';
import { buildings } from '../../src/shared/catalog.ts';
import { waitForWorld } from './fixtures/ready';
for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} construction previews the selected design and places its size, bill and angle`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-designer-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext(
      mobile
        ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        : { viewport: { width: 1440, height: 1000 } },
    );
    try {
      const { account, token } = app.universe.register('Designer');
      const w = createWorld('designer', 'Building workshop', account.id);
      w.buildings = [];
      w.zones = [];
      w.script = '';
      w.tier = 10;
      w.settings.mapSize = 500;
      w.settings.hungerRate = w.settings.thirstRate = 0;
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      const p = addPlayer(w, account.id, account.name);
      // Construction fixtures must stand outside the reserved respawn clearing.
      p.x = 80;
      p.y = terrainHeight(w, p.x, p.z);
      p.cash = 100000000;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(
        ({ token }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', 'designer');
          localStorage.setItem('aclone.quality', 'low');
        },
        { token },
      );
      await page.goto(`http://127.0.0.1:${port}`);
      await waitForWorld(page);
      const open = async () => {
        if (mobile) await page.locator('.mobile-nav [data-do="mobile-actions"]').click();
        await page.locator('[data-do="construction"]:visible').click();
      };
      await open();
      await page.getByLabel('Building type', { exact: true }).selectOption('pickup');
      await expect(
        page.getByLabel('Container colour', { exact: true }).locator('option'),
      ).toHaveCount(6);
      await page.getByLabel('Container colour', { exact: true }).selectOption('ocean-blue');
      await page.getByLabel('Building type', { exact: true }).selectOption('warehouse');
      await expect(
        page.getByLabel('Architectural model', { exact: true }).locator('option'),
      ).toHaveCount(5);
      await page.getByLabel('Architectural model', { exact: true }).selectOption('model-3');
      await expect(
        page.getByLabel('Surface finish', { exact: true }).locator('option'),
      ).toHaveCount(6);
      await page.getByLabel('Surface finish', { exact: true }).selectOption('metal-panel');
      const previewCanvas = page.locator('[data-build-preview] canvas');
      const referenceRadius = await previewCanvas.getAttribute('data-reference-radius');
      expect(Number(referenceRadius)).toBeGreaterThan(0);
      const metresPerPixel = await previewCanvas.getAttribute('data-metres-per-pixel');
      await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/build-standard-${mobile ? 'phone' : 'desktop'}.png`,
      });
      await page.getByLabel('Building size', { exact: true }).selectOption('large');
      await expect(previewCanvas).toHaveAttribute('data-reference-radius', referenceRadius!);
      await expect(previewCanvas).toHaveAttribute('data-metres-per-pixel', metresPerPixel!);
      await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/build-large-${mobile ? 'phone' : 'desktop'}.png`,
      });
      for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Rotate right' }).click();
      await expect(page.getByLabel('Building rotation', { exact: true })).toHaveValue('90');
      await expect(page.locator('[data-build-preview] canvas')).toBeVisible();
      const quote = buildingDesignQuote(
        'warehouse',
        buildings.warehouse,
        'metal-panel',
        'large',
        'model-3',
      );
      await expect(page.locator('[data-build-estimate]')).toContainText(
        `${quote.capacity.toLocaleString()} storage per good`,
      );
      await expect(page.getByRole('button', { name: 'Place foundation' })).toBeEnabled();
      await page.locator('[data-build-preview]').scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/build-designer-${mobile ? 'phone' : 'desktop'}.png`,
      });
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await open();
      await expect(page.getByLabel('Architectural model', { exact: true })).toHaveValue('model-3');
      await expect(page.getByLabel('Building size', { exact: true })).toHaveValue('large');
      await expect(page.getByLabel('Building rotation', { exact: true })).toHaveValue('90');
      await page.getByRole('button', { name: 'Place foundation' }).click();
      await expect.poll(() => w.buildings.length).toBe(1);
      const b = w.buildings[0];
      expect(b.architecture).toBe('model-3');
      expect(b.style).toBe('metal-panel');
      expect(b.size).toBe('large');
      expect(b.rotation).toBeCloseTo(Math.PI / 2);
      expect(b.capacity).toBe(quote.capacity);
      expect(b.construction).toEqual(quote.materials);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
