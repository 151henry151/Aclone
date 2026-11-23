// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';
import { createApp } from '../../src/server/app';

for (const phone of [false, true])
  test(`switching alts ${phone ? 'on a phone' : 'on desktop'} preserves saved keys, restores exported documents and rejects revoked keys clearly`, async ({
    page,
  }, info) => {
    if (phone) await page.setViewportSize({ width: 390, height: 844 });
    const dir = mkdtempSync(join(tmpdir(), 'aclone-restore-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    try {
      const a = app.universe.register('First alt'),
        b = app.universe.register('Second alt');
      const base = 'http://127.0.0.1:' + (await app.listen());
      await page.goto(base);
      const restore = async (key: string) => {
        await page.getByText('Been here before? Restore your pilot.', { exact: true }).click();
        await page.getByLabel('Pilot key', { exact: true }).fill(key);
        await page.getByRole('button', { name: 'Restore pilot', exact: true }).click();
      };
      await restore(a.token);
      await expect(page.locator('.pilot-card')).toContainText('First alt');
      await page.getByRole('button', { name: 'Pilot key & options', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Download pilot recovery key' })).toBeVisible();
      expect(
        await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).count(),
      ).toBe(1);
      await expect(
        page.getByRole('button', { name: 'Sign out of all devices', exact: true }),
      ).toBeDisabled();
      await page.screenshot({ path: info.outputPath('pilot-options.png') });
      await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
      expect(app.universe.authenticate(a.token)?.id).toBe(a.account.id);
      await restore(b.token);
      await expect(page.locator('.pilot-card')).toContainText('Second alt');
      await page.getByRole('button', { name: 'Pilot key & options', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
      await restore(
        `Aclone pilot: First alt\nKeep this key private. Paste it into Restore pilot.\n\n${a.token}\n`,
      );
      await expect(page.locator('.pilot-card')).toContainText('First alt');
      await page.reload();
      await expect(page.locator('.pilot-card')).toContainText('First alt');
      await page.getByRole('button', { name: 'Pilot key & options', exact: true }).click();
      await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
      app.store.db
        .prepare('UPDATE accounts SET token_hash=? WHERE id=?')
        .run('revoked', a.account.id);
      await restore(a.token);
      await expect(page.locator('#toast')).toContainText(/invalid|revoked/i);
      expect(await page.evaluate(() => localStorage.getItem('aclone.pilot'))).toBeNull();
      await page.getByLabel('Pilot key', { exact: true }).fill(b.token);
      await page.getByRole('button', { name: 'Restore pilot', exact: true }).click();
      await expect(page.locator('.pilot-card')).toContainText('Second alt');
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

test('browser sign-out from the parish keeps saved progress and the key, with the offline warning', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-local-logout-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const { account, token } = app.universe.register('Returning alt');
    const w = createWorld('local-logout', 'Local sign out', account.id);
    Object.assign(w, { script: '', towns: [], terrain: [], zones: [], buildings: [] });
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    Object.assign(w.settings, { dayLength: 0, time: 43200, hungerRate: 0, thirstRate: 0 });
    const p = addPlayer(w, account.id, account.name);
    p.inventory.logs = 17;
    p.cash = 12345;
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    await page.keyboard.press('F9');
    await page.getByRole('button', { name: 'Options & pilot key', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
    await expect(page.getByText('You are outside.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out of this browser', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to Aclone.' })).toBeVisible();
    await expect.poll(() => p.online).toBe(false);
    expect(p.inventory.logs).toBe(17);
    expect(p.cash).toBe(12345);
    expect(app.universe.authenticate(token)?.id).toBe(account.id);
    expect(await page.evaluate(() => localStorage.getItem('aclone.pilot'))).toBeNull();
    await page.getByText('Been here before? Restore your pilot.', { exact: true }).click();
    await page.getByLabel('Pilot key', { exact: true }).fill(token);
    await page.getByRole('button', { name: 'Restore pilot', exact: true }).click();
    await expect(page.locator('.pilot-card')).toContainText(account.name);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
