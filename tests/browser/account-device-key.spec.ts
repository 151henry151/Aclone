// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { WebSocket } from 'ws';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { tokenHash } from '../../src/server/universe';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('a phone with a retired pilot key automatically resumes the surviving character', async ({
  page,
}) => {
  test.setTimeout(180000);
  mkdirSync('output/account-device-key', { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), 'aclone-device-login-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  let desktop: WebSocket | undefined;
  try {
    const main = app.universe.register('Main pilot'),
      mobile = app.universe.register('Mobile pilot');
    const w = createWorld('device-login', 'Device login', main.account.id);
    Object.assign(w, {
      script: '',
      roads: [],
      towns: [],
      zones: [],
      terrain: [],
      buildings: [],
      airfield: undefined,
      spaceportSite: undefined,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      scatter: [],
      barriers: [],
      heightmap: Array(1089).fill(0),
    };
    Object.assign(w.settings, {
      mapSize: 1000,
      seaLevel: -10,
      dayLength: 0,
      time: 12 * 3600,
      hungerRate: 0,
      thirstRate: 0,
    });
    const p = addPlayer(w, main.account.id, main.account.name);
    Object.assign(p, {
      x: 0,
      z: 0,
      y: 0,
      vehicle: 5,
      inventory: {},
      skills: ['pilot', 'plant operator'],
      cash: 123450,
    });
    app.worlds.set(w.id, w);
    app.store.transaction(() => {
      app.store.db
        .prepare(
          `INSERT INTO account_device_keys(token_hash,account,primary_hash) SELECT ?,id,token_hash FROM accounts WHERE id=?`,
        )
        .run(tokenHash(mobile.token), main.account.id);
      app.store.db.prepare('DELETE FROM accounts WHERE id=?').run(mobile.account.id);
    });
    const port = await app.listen(),
      base = `http://127.0.0.1:${port}`;
    const auth = await page.request.get(base + '/api/auth/status', {
      headers: { authorization: 'Bearer ' + mobile.token },
    });
    expect(auth.status()).toBe(200);
    desktop = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const welcome = new Promise<any>((resolve) =>
      desktop!.on('message', (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.type === 'welcome') resolve(m);
      }),
    );
    await new Promise((resolve) => desktop!.once('open', resolve));
    desktop.send(JSON.stringify({ type: 'hello', protocol: 2, token: main.token, world: w.id }));
    expect((await welcome).account.id).toBe(main.account.id);
    const displaced = new Promise<number>((resolve) => desktop!.once('close', resolve));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token: mobile.token, world: w.id },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await waitForWorld(page);
    expect(await displaced).toBe(4001);
    await expect(page.locator('#connection')).toHaveText('CONNECTED');
    await expect(page.locator('#world-hud')).toContainText('Main pilot');
    expect(w.players[mobile.account.id]).toBeUndefined();
    expect(p.cash).toBe(123450);
    expect(p.skills).toEqual(['pilot', 'plant operator']);
    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await page.getByRole('button', { name: 'Skills & employment', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('plant operator');
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await page.locator('#mobile-status').click();
    await expect(page.getByRole('dialog', { name: 'Pilot status' })).toContainText('Main pilot');
    await page.screenshot({ path: 'output/account-device-key/phone-resumed.png' });
    await page.reload();
    await waitForWorld(page);
    await expect(page.locator('#world-hud')).toContainText('Main pilot');
    expect(app.universe.authenticate(main.token)?.id).toBe(main.account.id);
    expect(errors).toEqual([]);
  } finally {
    desktop?.terminate();
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
