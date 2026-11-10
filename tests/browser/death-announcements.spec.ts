// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, advance } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { WebSocket } from 'ws';
import { waitForWorld } from './fixtures/ready';
test('offline death chat stays quiet until a real reconnect and the rule remains editable', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-death-announcements-')),
    app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Village observer'),
      w = createWorld('death-announcements', 'Quiet parish', account.id);
    w.script = '';
    w.buildings = [];
    w.roads = [];
    w.towns = [];
    Object.assign(w.settings, {
      mapSize: 500,
      seaLevel: -10,
      hungerRate: 0,
      thirstRate: 0,
      dayLength: 0,
      time: 43200,
    });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { x: 0, y: 0, z: 0, vehicle: 0, speed: 0 });
    const absent = app.universe.register('Absent pilot');
    const q = addPlayer(w, absent.account.id, absent.account.name);
    q.inventory = {};
    const die = () => {
      q.health = 1;
      q.hunger = q.thirst = 50000;
      advance(w, 1);
    };
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', 'death-announcements');
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    die();
    die();
    expect(q.deaths).toBe(2);
    await page.reload();
    await waitForWorld(page);
    const deaths = page
      .locator('#chat-log .chat-line')
      .filter({ hasText: 'Absent pilot has begun a new life' });
    await expect(deaths).toHaveCount(1);
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    try {
      await new Promise<void>((resolve) => ws.once('open', resolve));
      const welcome = new Promise<void>((resolve) =>
        ws.on('message', (raw) => {
          if (JSON.parse(String(raw)).type === 'welcome') resolve();
        }),
      );
      ws.send(JSON.stringify({ type: 'hello', token: absent.token, world: w.id }));
      await welcome;
      expect(q.online).toBe(true);
      const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
      ws.close();
      await closed;
      await expect.poll(() => q.online).toBe(false);
    } finally {
      ws.terminate();
    }
    die();
    die();
    expect(q.deaths).toBe(4);
    await page.reload();
    await waitForWorld(page);
    await expect(deaths).toHaveCount(2);
    mkdirSync('output/death-announcements', { recursive: true });
    await deaths.last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'output/death-announcements/quiet-chat.png' });
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const form = page.locator('#settings-form');
    const rule = form.locator('[name="muteRepeatedOfflineDeaths"]');
    await expect(rule).toBeChecked();
    await rule.uncheck();
    await form.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect.poll(() => w.settings.muteRepeatedOfflineDeaths).toBe(false);
    die();
    expect(
      w.messages.filter((m) => m.text.includes('Absent pilot has begun a new life')),
    ).toHaveLength(3);
    await page.keyboard.press('Escape');
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    await expect(rule).not.toBeChecked();
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
