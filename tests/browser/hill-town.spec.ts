// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer, makeBuilding, terrainHeight } from '../../src/shared/simulation';
import { growRoads } from '../../src/shared/roads';
import { roadComponents } from '../../src/shared/road-routing';
import { townRoads, roadDistance } from '../../src/shared/town';
import { creatorSchema } from '../../src/shared/creator';

test('hill town furniture and distant village terrain render together', async ({ page }) => {
  test.setTimeout(360000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-hills-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('websocket', (socket) =>
    socket.on('framereceived', ({ payload }) => {
      try {
        const message = JSON.parse(String(payload));
        if (message.type === 'result' && !message.ok) errors.push(message.message);
      } catch {
        /* Vite frames aren't game messages. */
      }
    }),
  );
  try {
    const { account, token } = app.universe.register('Hills preview');
    const w = createWorld('puddlewick', 'Puddlewick', account.id);
    w.script = '';
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.creator = creatorSchema.parse({ weather: 'clear' });
    const town = makeBuilding('hill-centre', 'town', 560, -480);
    town.name = "Mabel's Reach";
    w.buildings.push(town);
    w.towns.push({
      ...structuredClone(w.towns[0]),
      id: 'reach',
      name: town.name,
      x: town.x,
      z: town.z,
      radius: 60,
      plinth: town.id,
    });
    w.buildings.push(makeBuilding('road-obstacle', 'warehouse', 49, -2));
    growRoads(w, 0, 600 * 180);
    expect(w.retiredRoads?.length).toBeGreaterThan(0);
    expect(
      roadComponents(townRoads(w)).some(
        (group) => roadDistance(group, town.x, town.z) < 25 && roadDistance(group, 0, 0) < 80,
      ),
    ).toBe(true);
    const p = addPlayer(w, account.id, account.name);
    p.x = town.x + 13;
    p.z = town.z - 17;
    p.heading = Math.atan2(-p.x, -p.z);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await expect
      .poll(() => ({ errors, online: p.online }), { timeout: 30000 })
      .toEqual({ errors: [], online: true });
    await expect(page.locator('#world-hud')).toBeVisible({ timeout: 90000 });
    await expect(page.locator('#startup-loading')).toBeHidden({ timeout: 90000 });
    await page.mouse.move(720, 420);
    await page.mouse.down();
    await page.mouse.move(720, 390, { steps: 8 });
    await page.mouse.up();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let n = 0;
          const frame = () => (++n >= 8 ? resolve() : requestAnimationFrame(frame));
          requestAnimationFrame(frame);
        }),
    );
    await page.screenshot({ path: 'output/hill-town/distant-town.png' });
    await page.mouse.move(720, 420);
    await page.mouse.down();
    await page.mouse.move(945, 410, { steps: 8 });
    await page.mouse.up();
    await page.mouse.wheel(0, -200);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let n = 0;
          const frame = () => (++n >= 8 ? resolve() : requestAnimationFrame(frame));
          requestAnimationFrame(frame);
        }),
    );
    await page.screenshot({ path: 'output/hill-town/tractor-on-slope.png' });
    // Move the test pilot only; the scene, roads and warehouse are normal game content.
    Object.assign(p, { x: 50, z: 28, y: terrainHeight(w, 50, 28), heading: Math.PI });
    await page.mouse.move(945, 410);
    await page.mouse.down();
    await page.mouse.move(720, 520, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('#world-hud')).toContainText('town of Puddlewick');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let n = 0;
          const frame = () => (++n >= 12 ? resolve() : requestAnimationFrame(frame));
          requestAnimationFrame(frame);
        }),
    );
    await page.screenshot({ path: 'output/hill-town/road-bypass.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
