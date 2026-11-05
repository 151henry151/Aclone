// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { exportDesign } from '../../src/server/world-design';
import { waitForWorld } from './fixtures/ready';
test('a player imports a scripted design and receives its welcome through the native worker', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-script-import-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Workshop host'),
      w = createWorld('script-studio', 'Script studio', account.id);
    w.script = '';
    Object.assign(w.settings, { dayLength: 0, time: 43200, hungerRate: 0, thirstRate: 0 });
    addPlayer(w, account.id, account.name);
    app.worlds.set(w.id, w);
    const design = exportDesign(w);
    design.script =
      'on("PlayerLogin", function(e) announce("Welcome to the workshop! The world script is running.") end)';
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        if (!localStorage.getItem('aclone.world')) localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Transfer', exact: true }).click();
    const form = page.locator('#creator-import-form');
    await form.getByLabel('New world name').fill('Scripted welcome');
    await form.getByLabel('World design JSON').setInputFiles({
      name: 'workshop.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(design)),
    });
    await form.getByRole('button', { name: 'Create world from design', exact: true }).click();
    await expect(page.locator('#toast')).toContainText('Imported world created');
    const imported = [...app.worlds.values()].find((v) => v.name === 'Scripted welcome')!;
    expect(imported).toBeTruthy();
    await page.evaluate((id) => localStorage.setItem('aclone.world', id), imported.id);
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#chat-log')).toContainText(
      'Welcome to the workshop! The world script is running.',
    );
    expect(imported.messages.some((m) => m.name === 'Script error')).toBe(false);
    await expect(page.locator('#toast')).toHaveCSS('opacity', '0');
    await page.screenshot({ path: 'output/release-0.121.1/scripted-world.png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
