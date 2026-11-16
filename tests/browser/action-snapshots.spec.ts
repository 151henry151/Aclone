// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { ensurePastures } from '../../src/shared/pastures';
import { waitForWorld } from './fixtures/ready';

for (const kind of ['garage', 'dairy', 'market'] as const)
  test(`${kind} action updates survive a state delayed beyond the acknowledgement`, async ({
    page,
  }) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-action-snapshot-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true, tick: false });
    try {
      const { account, token } = app.universe.register('Customer');
      const world = createWorld('action-snapshots', 'Delayed states', account.id);
      world.script = '';
      world.towns = [];
      world.roads = [];
      world.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      world.landscape = {
        paths: [],
        surfaces: [],
        barriers: [],
        scatter: [],
        heightmap: Array(1089).fill(0),
      };
      Object.assign(world.settings, {
        mapSize: 500,
        seaLevel: -10,
        hungerRate: 0,
        thirstRate: 0,
        arrivalAnimation: 'off',
        salesTax: 0,
      });
      const building = makeBuilding('shop', kind, 0, 0);
      world.buildings = [building];
      const player = addPlayer(world, account.id, account.name);
      Object.assign(player, {
        x: 0,
        z: 12,
        y: 0,
        engine: false,
        cash: kind === 'market' ? 100 : 1000000,
        inventory: {},
      });
      if (kind === 'dairy') {
        building.owner = player.id;
        building.stock = { cows: 4, feed: 100, water: 100 };
        ensurePastures(world);
      }
      if (kind === 'market')
        Object.assign(building, {
          owner: 'seller',
          government: true,
          stock: { fuel: 2 },
          buy: {},
          sell: { fuel: 100 },
          investment: 0,
        });
      app.worlds.set(world.id, world);
      const port = await app.listen();
      await page.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
          const gate = { hold: false, replies: 0, states: [] as (() => void)[] };
          (window as any).__stateGate = gate;
          const listen = WebSocket.prototype.addEventListener;
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
                const message = JSON.parse((event as MessageEvent).data);
                const deliver = () => listener.call(this, event);
                if (message.type === 'result') gate.replies++;
                if (message.type === 'state' && gate.hold) gate.states.push(deliver);
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
      await page.keyboard.press('e');
      await expect(page.getByRole('dialog')).toBeVisible();
      if (kind === 'garage')
        await page.locator('[data-fleet-disclosure="tractor-shop"] > summary').click();
      const button =
        kind === 'garage'
          ? page.locator('#tractor-specs').getByRole('button', { name: 'Plum purple', exact: true })
          : kind === 'dairy'
            ? page.getByRole('button', { name: /Buy adjoining pasture/ })
            : page.locator('[data-do="trade"][data-item="fuel"][data-direction="buy"]');
      const original = await button.elementHandle();
      await page.evaluate(() => {
        const gate = (window as any).__stateGate;
        gate.replies = 0;
        gate.hold = true;
      });
      await button.click();
      await expect
        .poll(() => page.evaluate(() => (window as any).__stateGate.replies))
        .toBeGreaterThan(0);
      await expect
        .poll(() => page.evaluate(() => (window as any).__stateGate.states.length))
        .toBeGreaterThan(0);
      // The former 100 ms refresh fires before the accepted state reaches the UI.
      await page.waitForTimeout(300);
      if (kind === 'market') expect(await original!.evaluate((el) => el.isConnected)).toBe(true);
      await page.evaluate(() => {
        const gate = (window as any).__stateGate;
        gate.hold = false;
        gate.states.splice(0).forEach((deliver: () => void) => deliver());
      });
      if (kind === 'garage') {
        expect(player.vehiclePaints?.[0]).toBe('plum');
        await expect(page.locator('#tractor-specs .vehicle-paint-shop')).toContainText(
          'Finish: Plum purple',
        );
      } else if (kind === 'dairy') {
        expect(building.pasture?.parcels).toBe(2);
        await expect(page.getByText(/4 \/ 8 adult shares occupied/)).toBeVisible();
      } else {
        const row = page.locator('.trade-row').filter({ has: button });
        await expect(row).toContainText('1 /');
        await expect(row).toContainText('You have 1');
        expect(player.cash).toBe(0);
        expect(building.stock.fuel).toBe(1);
        await button.click();
        await expect(page.locator('#toast')).toContainText('Not enough cash');
        expect(await original!.evaluate((el) => el.isConnected)).toBe(true);
      }
      await page.screenshot({ path: `test-results/action-snapshot-${kind}.png` });
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
