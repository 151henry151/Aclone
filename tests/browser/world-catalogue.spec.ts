// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
test('creators define goods and professions with forms and inspect supply-chain costs', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-catalogue-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      { account, token } = app.universe.register('Catalogue maker'),
      w = app.worlds.get('puddlewick')!;
    w.owner = account.id;
    const p = addPlayer(w, account.id, account.name);
    p.authority = 20;
    app.store.saveWorld(w);
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Catalogue', exact: true }).click();
    const item = page.locator('#creator-catalogue-item-form');
    await item.getByLabel('Name', { exact: true }).fill('Mountain tea');
    await item.getByLabel('Thirst relief').fill('12000');
    await item.getByRole('button', { name: 'Save item' }).click();
    await expect.poll(() => w.catalogue?.items['custom:herbal_tea']?.drink).toBe(12000);
    const skill = page.locator('#creator-catalogue-skill-form');
    await skill.getByLabel('Lesson seconds').fill('2');
    await skill.getByRole('button', { name: 'Save profession' }).click();
    await expect.poll(() => w.catalogue?.skills['custom:tea_blender']?.seconds).toBe(2);
    await page.getByRole('button', { name: 'Production', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Production chain check' })).toBeVisible();
    await expect(page.locator('[name=outputs0]')).toContainText('Mountain tea');
    const source = await page.locator('[name=recipeBuilding]').inputValue();
    expect(w.buildings.find((b) => b.id === source)?.kind).not.toBe('farm');
    await expect(page.locator('[name=skill]')).toContainText('custom:tea_blender');
    await page.getByRole('heading', { name: 'Production chain check' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/world-production-diagnostics.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
