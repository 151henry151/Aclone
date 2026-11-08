// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, move } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { Navigator } from '../../src/server/npc/navigation';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
for (const overlap of [false, true])
  test(
    overlap
      ? 'a trapped resident walks out of a trailer overlap'
      : 'a resident drives around a parked trailer without moving it',
    async ({ page }) => {
      const dir = mkdtempSync(join(tmpdir(), 'aclone-trailer-nav-'));
      const app = await createApp({ dataDir: dir, port: 0, dev: true });
      const { account, token } = app.universe.register('Trailer observer');
      const w = createWorld('trailer-navigation', 'Trailer navigation', account.id);
      w.script = '';
      w.buildings = [];
      w.roads = [];
      w.towns = [];
      w.zones = [];
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
      w.landscape = {
        heightmap: Array(1089).fill(0),
        paths: [],
        surfaces: [],
        barriers: [],
        scatter: [],
      };
      Object.assign(w.settings, {
        seaLevel: -10,
        dayLength: 0,
        time: 43200,
        hungerRate: 0,
        thirstRate: 0,
      });
      const observer = addPlayer(w, account.id, account.name);
      Object.assign(observer, { x: 18, z: 0, y: 0, heading: -Math.PI / 2, vehicle: 5, speed: 0 });
      const npc = addPlayer(w, 'trailer-resident', 'Mabel');
      Object.assign(npc, {
        x: overlap ? 0.9 : 0,
        z: overlap ? 0 : -18,
        y: 0,
        heading: 0,
        vehicle: overlap ? 5 : 0,
        fuel: 50,
        engine: true,
        online: true,
        npc: true,
      });
      w.trailers = {
        box: {
          id: 'box',
          owner: account.id,
          kind: 'box',
          x: 0,
          z: 0,
          heading: overlap ? 0 : Math.PI / 3,
          cargo: { wood: 2 },
        },
      };
      app.worlds.set(w.id, w);
      const target = overlap ? { x: 12, z: 0 } : { x: 0, z: 18 };
      const nav = new Navigator(w, npc, target, 2, false, true);
      const original = structuredClone(w.trailers);
      let running = false,
        arrived = false,
        error: string | undefined;
      const timer = setInterval(() => {
        if (!running || arrived || error) return;
        const result = nav.step(w, npc, 0.05);
        error = result.error;
        arrived = !!result.arrived;
        move(w, npc, result.input, 0.05);
      }, 50);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      mkdirSync('output/trailer-feedback/browser', { recursive: true });
      try {
        const port = await app.listen();
        await page.addInitScript(
          ({ token, world }) => {
            localStorage.setItem('aclone.pilot', token);
            localStorage.setItem('aclone.world', world);
            localStorage.setItem('aclone.quality', 'low');
            localStorage.setItem('aclone.sound', 'off');
          },
          { token, world: w.id },
        );
        await page.goto(`http://127.0.0.1:${port}`);
        await waitForWorld(page);
        await page.waitForTimeout(1000);
        running = true;
        if (!overlap) {
          await expect.poll(() => npc.z, { timeout: 15000 }).toBeGreaterThan(-4);
          await page.screenshot({
            path: 'output/trailer-feedback/browser/resident_detours_trailer.png',
          });
        }
        await expect.poll(() => error ?? arrived, { timeout: 30000 }).toBe(true);
        await page.waitForTimeout(1000);
        expect(w.trailers).toEqual(original);
        expect(errors).toEqual([]);
        await page.screenshot({
          path: `output/trailer-feedback/browser/${overlap ? 'resident_escaped_overlap' : 'resident_reached_destination'}.png`,
        });
      } finally {
        clearInterval(timer);
        await page.close();
        await app.close();
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
