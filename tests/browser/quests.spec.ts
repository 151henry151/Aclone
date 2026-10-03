// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { addPlayer } from '../../src/shared/simulation.ts';
import { currentProgress } from '../../src/shared/quests.ts';
test('creator saves a quest without code and a mobile player accepts and completes it', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-quests-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    const { account, token } = app.universe.register('Questmaker');
    const w = app.worlds.get('puddlewick')!;
    w.owner = account.id;
    const p = addPlayer(w, account.id, account.name);
    p.authority = 20;
    const b = w.buildings.find((b) => b.kind === 'market')!;
    p.x = b.x;
    p.z = b.z + 10;
    app.store.saveWorld(w);
    await page.addInitScript((token) => {
      localStorage.setItem('aclone.pilot', token);
      localStorage.setItem('aclone.world', 'puddlewick');
      localStorage.setItem('aclone.quality', 'low');
    }, token);
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible();
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    const form = page.locator('#creator-quest-form');
    await form.getByLabel('Title', { exact: true }).fill('Meet the Harbour keeper');
    await form.locator('[name=description]').fill('Visit the Harbour and introduce yourself.');
    await form.locator('[name=event0]').selectOption('interact');
    await form.locator('[name=target0]').selectOption(b.id);
    await form.getByRole('button', { name: 'Save quest' }).click();
    await expect.poll(() => w.creator?.quests.length).toBe(1);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#brand-button').click();
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByRole('button', { name: 'Accept quest' }).click();
    const q = w.creator!.quests[0];
    await expect.poll(() => !!currentProgress(p, q)).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: 'World interaction', exact: true }).click();
    await expect.poll(() => currentProgress(p, q)?.step).toBe(1);
    await page.locator('#brand-button').click();
    await page.getByRole('button', { name: 'Quests', exact: true }).click();
    await page.getByRole('button', { name: 'Collect reward' }).click();
    await expect.poll(() => currentProgress(p, q)?.claimed).toBe(true);
    await expect(page.locator('article')).toContainText('Reward collected.');
    await page.screenshot({ path: 'test-results/quests-mobile.png' });
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
