// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('a delayed rule-save reply cannot replace the reopened editor or discard its draft', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-panel-replies-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
  try {
    const { account, token } = app.universe.register('Editor');
    const world = createWorld('reply-browser', 'Reply test', account.id);
    world.script = '';
    world.buildings = [];
    world.roads = [];
    world.towns = [];
    world.zones = [];
    world.resources = {};
    world.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
    world.landscape = {
      paths: [],
      surfaces: [],
      barriers: [],
      scatter: [],
      heightmap: Array(1089).fill(0),
    };
    Object.assign(world.settings, { mapSize: 500, seaLevel: -10, hungerRate: 0, thirstRate: 0 });
    Object.assign(addPlayer(world, account.id, account.name), { vehicle: 5, x: 0, z: 0 });
    app.worlds.set(world.id, world);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        // Keep real server snapshots flowing, but deliver action replies only when
        // requested, reproducing a slow reply after the player revisits the same tab.
        const listen = WebSocket.prototype.addEventListener;
        const pending: (() => void)[] = [];
        (window as any).__panelReplies = pending;
        WebSocket.prototype.addEventListener = function (
          this: WebSocket,
          type: string,
          listener: any,
          options: any,
        ) {
          if (type !== 'message') return listen.call(this, type, listener, options);
          return listen.call(
            this,
            type,
            (event: Event) => {
              const deliver = () => listener.call(this, event);
              if (JSON.parse((event as MessageEvent).data).type === 'result') pending.push(deliver);
              else deliver();
            },
            options,
          );
        } as typeof listen;
      },
      { token, id: world.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const edit = async () => {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
    };
    await edit();
    const field = page.locator('[name="expandedConstructionCostMultiplier"]');
    await field.fill('3');
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    await expect
      .poll(() => app.worlds.get(world.id)!.settings.expandedConstructionCostMultiplier)
      .toBe(3);
    await expect
      .poll(() => page.evaluate(() => (window as any).__panelReplies.length))
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await edit();
    await expect(field).toHaveValue('3');
    await field.fill('4');
    const original = await field.elementHandle();
    await page.getByRole('button', { name: 'Apply changes to server', exact: true }).focus();
    await page.evaluate(() =>
      (window as any).__panelReplies.splice(0).forEach((deliver: () => void) => deliver()),
    );
    await page.waitForTimeout(300);
    expect(await original!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(field).toHaveValue('4');
    expect(app.worlds.get(world.id)!.settings.expandedConstructionCostMultiplier).toBe(3);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
