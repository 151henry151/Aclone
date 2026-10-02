// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { createApp } from '../../src/server/app.ts';
import { Store } from '../../src/server/store.ts';
import { Universe } from '../../src/server/universe.ts';
import { Federation } from '../../src/server/federation.ts';
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
test('browser travels between two hosts and returns to saved native progress', async ({ page }) => {
  const dirs = [
      mkdtempSync(join(tmpdir(), 'aclone-galaxy-a-')),
      mkdtempSync(join(tmpdir(), 'aclone-galaxy-b-')),
    ],
    ports = [await freePort(), await freePort()],
    urls = ports.map((p) => `http://127.0.0.1:${p}`),
    names = ['Hearth', 'Orchard'];
  const descriptors = dirs.map((dir, i) => {
    const store = new Store(join(dir, 'aclone.sqlite'));
    try {
      return new Federation(store, new Universe(store), {
        name: names[i],
        url: urls[i],
        peers: [],
      }).descriptor();
    } finally {
      store.close();
    }
  });
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const app = await createApp({
        dataDir: dirs[i],
        port: ports[i],
        dev: true,
        federation: { ...descriptors[i], peers: [descriptors[1 - i]] },
      });
      apps.push(app);
      await app.listen();
    }
    const home = apps[0].universe.register('Ada Voyager'),
      local = apps[1].universe.register('Local Orchard');
    home.account.credits = 777;
    apps[0].universe.save(home.account);
    local.account.credits = 888;
    apps[1].universe.save(local.account);
    await page.addInitScript(
      ({ urls, home, local }) => {
        const key = location.origin === urls[0] ? home : local;
        if (!localStorage.getItem('aclone.pilot')) localStorage.setItem('aclone.pilot', key);
      },
      { urls, home: home.token, local: local.token },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(urls[0]);
    await page.getByRole('button', { name: 'Travel to Orchard', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Arrive in Orchard' })).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await page.getByRole('button', { name: 'Continue as Ada Voyager' }).click();
    await expect(page.locator('.galaxy-view')).toContainText('Visiting character: Ada Voyager');
    expect(await page.evaluate(() => localStorage.getItem('aclone.homePilot'))).toBe(local.token);
    const guestKey = await page.evaluate(() => localStorage.getItem('aclone.pilot'));
    const guest = apps[1].universe.authenticate(guestKey!)!;
    expect(guest.traveler?.subject).toBe(home.account.id);
    expect(guest.credits).toBe(50);
    guest.credits = 63;
    apps[1].universe.save(guest);
    await page.screenshot({ path: 'test-results/galaxy-visitor.png' });
    await page.getByRole('button', { name: 'Travel to Hearth', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Arrive in Hearth' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue as Ada Voyager' }).click();
    await expect(page.locator('.pilot-card')).toContainText('777');
    expect(await page.evaluate(() => localStorage.getItem('aclone.pilot'))).toBe(home.token);
    await page.getByRole('button', { name: 'Travel to Orchard', exact: true }).click();
    await page.getByRole('button', { name: 'Continue as Ada Voyager' }).click();
    await expect(page.locator('.pilot-card')).toContainText('63');
    expect(apps[1].universe.authenticate(local.token)?.credits).toBe(888);
    expect(errors).toEqual([]);
  } finally {
    for (const app of apps) await app.close();
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
