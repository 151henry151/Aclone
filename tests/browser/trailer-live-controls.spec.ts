// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { fifthWheel, kingpin } from '../../src/shared/highway-geometry';
import { hitchRefusal } from '../../src/shared/trailers';
import { waitForWorld } from './fixtures/ready';

test('open trailer controls follow stopped and coupling snapshots without losing drafts', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-trailer-controls-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const { account, token } = app.universe.register('Coupling inspector');
    const w = createWorld('trailer-controls', 'Trailer controls', account.id);
    Object.assign(w, { script: '', towns: [], roads: [], buildings: [], terrain: [], zones: [] });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'clear' });
    w.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(20),
    };
    Object.assign(w.settings, {
      mapSize: 500,
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
    });
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, {
      x: 0,
      z: 0,
      y: 20,
      heading: 0,
      vehicle: 37,
      fleet: [5, 37],
      inventory: { wood: 20, steel: 10 },
      skills: ['driver'],
      engine: false,
    });
    const t = {
      id: 'box',
      owner: p.id,
      kind: 'semiBox' as const,
      x: 0,
      z: 0,
      heading: 0,
      cargo: {},
    };
    t.z = fifthWheel(w, p).z - kingpin(w, t).z;
    w.trailers = { box: t };
    expect(hitchRefusal(w, p, t)).toBeUndefined();
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        const send = WebSocket.prototype.send;
        WebSocket.prototype.send = function (data) {
          (window as any).__trailerSocket = this;
          return send.call(this, data);
        };
      },
      { token, id: w.id },
    );
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    // Freeze simulation time; a real harmless action publishes each chosen state.
    // Bypass only action-view refresh bookkeeping so this tests snapshot refresh.
    const sync = async () => {
      w.time += 1;
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            const socket: WebSocket = (window as any).__trailerSocket;
            const receive = (event: MessageEvent) => {
              if (JSON.parse(event.data).type !== 'state') return;
              socket.removeEventListener('message', receive);
              resolve();
            };
            socket.addEventListener('message', receive);
            socket.send(JSON.stringify({ type: 'action', action: { type: 'horn' } }));
          }),
      );
    };
    p.speed = 1;
    await sync();
    await page.keyboard.press('i');
    const trailers = page.locator('[data-fleet-disclosure="owned-trailers"]');
    await trailers.locator('summary').click();
    const hitch = trailers.getByRole('button', { name: 'Hitch trailer', exact: true });
    const load = trailers.getByRole('button', { name: 'Load', exact: true });
    const quantity = trailers.getByLabel('Quantity', { exact: true });
    const item = trailers.getByRole('combobox');
    await expect(hitch).toBeDisabled();
    await expect(load).toBeDisabled();
    await expect(trailers).toContainText('Come to a full stop');
    await quantity.fill('7');
    await item.selectOption('steel');
    await quantity.focus();
    const nodes = await Promise.all([
      hitch.elementHandle(),
      load.elementHandle(),
      quantity.elementHandle(),
      trailers.locator('summary').elementHandle(),
    ]);
    p.speed = 0;
    await sync();
    await expect(hitch).toBeEnabled();
    await expect(load).toBeEnabled();
    await expect(trailers).not.toContainText('Come to a full stop');
    p.speed = -1;
    await sync();
    await expect(hitch).toBeDisabled();
    await expect(load).toBeDisabled();
    p.speed = 0;
    t.heading = Math.PI / 4;
    const pin = kingpin(w, t),
      wheel = fifthWheel(w, p);
    t.x += wheel.x - pin.x;
    t.z += wheel.z - pin.z;
    await sync();
    await expect(trailers).toContainText('Align the highway tractor');
    await expect(hitch).toBeDisabled();
    await expect(load).toBeEnabled();
    t.heading = 0;
    t.x = 0;
    t.z = 0;
    t.z = fifthWheel(w, p).z - kingpin(w, t).z;
    t.z -= 2;
    await sync();
    await expect(trailers).toContainText('Reverse the fifth wheel');
    t.z += 2;
    await sync();
    await expect(hitch).toBeEnabled();
    for (const node of nodes) expect(await node!.evaluate((n) => n.isConnected)).toBe(true);
    await expect(quantity).toBeFocused();
    await expect(quantity).toHaveValue('7');
    await expect(item).toHaveValue('steel');
    await expect(trailers).toHaveAttribute('open', '');
    await page.screenshot({ path: 'test-results/trailer-controls-ready.png' });
    await hitch.click();
    await expect.poll(() => w.trailers!.box.attached).toBe(p.id);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
