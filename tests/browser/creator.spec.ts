// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
for (const mobile of [false, true])
  test(`${mobile ? 'phone' : 'desktop'} creator builds models, behaviors, recipes and exports designs`, async ({
    browser,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-creator-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    try {
      const { account, token } = app.universe.register('World designer');
      const w = createWorld('studio', 'Studio', account.id),
        p = addPlayer(w, account.id, account.name);
      w.script = '';
      w.settings.hungerRate = w.settings.thirstRate = 0;
      w.settings.dayLength = 0;
      w.settings.time = 43200;
      app.worlds.set(w.id, w);
      const port = await app.listen();
      await page.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
        },
        { token, id: w.id },
      );
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://127.0.0.1:${port}`);
      await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
      // The same editor is reachable through desktop keyboard and the mobile menu.
      if (mobile) {
        await page.getByRole('button', { name: 'Open game menu' }).click();
        await page.getByRole('button', { name: 'World editor', exact: true }).click();
      } else await page.getByRole('button', { name: 'Editor F10' }).click();
      await expect(page.getByRole('heading', { name: 'World creator studio' })).toBeVisible();
      await page.getByRole('button', { name: 'Workshop', exact: true }).click();
      await page.getByLabel('Model name', { exact: true }).fill('Copper pine');
      await expect(page.locator('#creator-preview canvas')).toBeVisible();
      await page.getByRole('button', { name: 'Save model', exact: true }).click();
      await expect.poll(() => w.creator?.models[0]?.name).toBe('Copper pine');
      // Saving redraws the workshop after the authoritative state changes.
      await expect(async () => {
        await page.locator('#creator-preview').scrollIntoViewIfNeeded();
        await expect(page.locator('#creator-preview')).toBeInViewport();
      }).toPass({ timeout: 10000 });
      await page.screenshot({
        path: `test-results/creator-workshop-${mobile ? 'phone' : 'desktop'}.png`,
      });
      await page.getByRole('button', { name: 'Objects', exact: true }).click();
      const obj = page.locator('#creator-object-form');
      await obj.locator('[name="name"]').fill('Water tree');
      await obj.locator('[name="x"]').fill(String(Math.round(p.x)));
      await obj.locator('[name="z"]').fill(String(Math.round(p.z)));
      await obj.locator('[name="prompt"]').fill('Drink at the tree');
      await obj.getByRole('button', { name: 'Place object' }).click();
      await expect.poll(() => w.creator?.objects.length).toBe(1);
      await page.getByRole('button', { name: 'Behaviors', exact: true }).click();
      const rule = page.locator('#creator-rule-form');
      await rule.locator('[name="target"]').selectOption(w.creator!.objects[0].id);
      await rule.locator('[name="text"]').fill('A welcome from the copper tree.');
      await expect(rule.locator('[name="item"]')).toBeHidden();
      await rule.getByRole('button', { name: 'Save behavior' }).click();
      await expect.poll(() => w.creator?.rules.length).toBe(1);
      await page.getByRole('button', { name: 'Layout', exact: true }).click();
      const layout = page.locator('#creator-building-form'),
        mill = w.buildings.find((b) => b.kind === 'mill')!;
      await layout.locator('[name="building"]').selectOption(mill.id);
      await expect(layout.locator('[name="x"]')).toHaveValue(String(mill.x));
      await layout.locator('[name="name"]').fill('Copper Mill');
      await layout.getByRole('button', { name: 'Update building' }).click();
      await expect.poll(() => mill.name).toBe('Copper Mill');
      await page.getByRole('button', { name: 'Production', exact: true }).click();
      const recipe = page.locator('#creator-recipe-form');
      await recipe.locator('[name="recipeBuilding"]').selectOption(mill.id);
      await expect(recipe.locator('[name="inputs0"]')).toHaveValue('wheat');
      await recipe.locator('[name="outputsQty0"]').fill('4');
      await recipe.getByRole('button', { name: 'Save production recipe' }).click();
      await expect.poll(() => mill.production?.outputs.flour).toBe(4);
      await page.getByRole('button', { name: 'Arena', exact: true }).click();
      const arena = page.locator('#creator-arena-form');
      await arena.locator('[name="mode"]').selectOption('ctf');
      await arena.locator('[name="team0"]').fill('Copper');
      await arena.getByRole('button', { name: 'Save arena rules' }).click();
      await expect.poll(() => w.creator?.arena.teams[0]).toBe('Copper');
      await page.getByRole('button', { name: 'Transfer', exact: true }).click();
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download world design' }).click();
      expect((await download).suggestedFilename()).toContain('design');
      await page.getByRole('button', { name: 'Close dialog' }).click();
      await page.keyboard.press('e');
      await expect(page.getByRole('button', { name: 'Drink at the tree' })).toBeVisible();
      await page.getByRole('button', { name: 'Drink at the tree' }).click();
      await expect
        .poll(() => w.messages.some((m) => m.text === 'A welcome from the copper tree.'))
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
