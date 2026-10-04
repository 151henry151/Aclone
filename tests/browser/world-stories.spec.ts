// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app.ts';
import { createWorld, addPlayer } from '../../src/shared/simulation.ts';
import { creatorSchema } from '../../src/shared/creator.ts';
test('authors write readable books and announce town events through the editor', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-stories-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Storyteller'),
      w = createWorld('stories', 'Stories', account.id, 'playground'),
      p = addPlayer(w, account.id, account.name);
    w.script = '';
    w.buildings = [];
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    p.inventory.bread = 1;
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
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 60000 });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Books', exact: true }).click();
    const form = page.locator('#creator-book-form');
    await form.getByLabel('Book title').fill('The village story');
    await form.getByRole('combobox', { name: 'Carried item' }).selectOption('bread');
    await form
      .getByLabel('Page 1 text')
      .fill('Welcome <img src=x onerror=alert(1)> to our village.');
    await form.getByRole('button', { name: 'Save book' }).click();
    await expect.poll(() => w.creator?.books.length).toBe(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await page.getByRole('button', { name: 'Read The village story' }).click();
    await expect(page.getByRole('dialog', { name: 'The village story' })).toContainText(
      'Welcome <img src=x onerror=alert(1)>',
    );
    await expect(page.locator('.window img')).toHaveCount(0);
    expect(p.inventory.bread).toBe(1);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Town events', exact: true }).click();
    const event = page.locator('#creator-event-form');
    await event.getByLabel('Event title').fill('Market day');
    await event.getByLabel('First day').fill('0');
    await event.getByRole('button', { name: 'Save town event' }).click();
    await expect.poll(() => w.creator?.townEvents.length).toBe(1);
    await expect
      .poll(() => w.messages.some((m) => m.name === 'Town event' && m.text.includes('Market day')))
      .toBe(true);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
