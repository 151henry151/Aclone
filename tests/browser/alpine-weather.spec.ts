// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { creatorSchema } from '../../src/shared/creator';
import { terrainHeight } from '../../src/shared/terrain';
import { waitForWorld } from './fixtures/ready';

test('summer lowland rain opens a walking umbrella while summit snow closes it and agrees with the HUD', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-alpine-weather-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Alpine walker');
    const w = createWorld('puddlewick', 'Alpine weather audit', 'server');
    w.settings.mapSize = 18500;
    w.terrainMapSize = 12500;
    w.townLayout = 2;
    expandPuddlewickIsland(w);
    w.id = 'alpine-weather-audit';
    w.owner = account.id;
    w.script = '';
    w.buildings = [];
    w.creator = creatorSchema.parse({ scenery: false, weather: 'rain' });
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.time = 130 * 600;
    w.climate = { snow: 0, snowDepth: 0, wetness: 1 };
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { vehicle: 5, x: 0, z: 0, y: terrainHeight(w, 0, 0), engine: false });
    app.worlds.set(w.id, w);
    // Observe the real application's scene without changing its behavior.
    await page.route('**/src/client/main.ts*', async (route) => {
      const response = await route.fetch();
      const observe = `import {GameScene as AuditScene} from '/src/client/scene.ts';
const auditSetWorld=AuditScene.prototype.setWorld;
AuditScene.prototype.setWorld=function(...args){globalThis.__alpineScene=this;return auditSetWorld.apply(this,args)};\n`;
      await route.fulfill({ response, body: observe + (await response.text()) });
    });
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    const port = await app.listen();
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    const umbrella = () =>
      page.evaluate(() => {
        const s = (window as any).__alpineScene;
        return s.meshes.get(s.me.id)?.userData.umbrella?.openness;
      });
    await expect(page.locator('#clock')).toContainText('Summer');
    await expect(page.locator('#clock')).toContainText(' · rain · ');
    await expect.poll(umbrella).toBe(1);
    await page.screenshot({ path: 'test-results/alpine-lowland-rain.png' });
    const mountain = w.northernIsland!.mountain;
    Object.assign(app.worlds.get(w.id)!.players[account.id], {
      x: mountain.x,
      z: mountain.z,
      y: terrainHeight(w, mountain.x, mountain.z),
    });
    await expect(page.locator('#clock')).toContainText(' · snow · ');
    await expect.poll(umbrella).toBe(0);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = (window as any).__alpineScene;
          return s.ground.group.children.some(
            (t: any) => Math.hypot(t.position.x - s.me.x, t.position.z - s.me.z) < 200,
          );
        }),
      )
      .toBe(true);
    await page.screenshot({ path: 'test-results/alpine-summit-snow.png' });
    app.worlds.get(w.id)!.creator!.weather = 'clear';
    await expect(page.locator('#clock')).toContainText(' · clear · ');
    await expect.poll(umbrella).toBe(0);
    await expect
      .poll(() => page.evaluate(() => (window as any).__alpineScene.precipitation.mesh.visible))
      .toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
