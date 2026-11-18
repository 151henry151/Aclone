// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

for (const startupGap of [false, true])
  test(`a seated arrival prepares the first walking resident and rain umbrella before play${startupGap ? ' after a long preparation gap' : ''}`, async ({
    page,
  }, testInfo) => {
    const dir = mkdtempSync(join(tmpdir(), 'aclone-actor-warmup-'));
    const app = await createApp({ dataDir: dir, port: 0, dev: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      const { account, token } = app.universe.register('Warmup driver');
      const w = createWorld('actor-warmup', 'Actor warmup', account.id);
      w.script = '';
      w.towns = [];
      w.terrain = [];
      w.zones = [];
      w.buildings = [];
      w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'rain' });
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
        arrivalAnimation: 'off',
      });
      const p = addPlayer(w, account.id, account.name);
      Object.assign(p, { vehicle: 37, fleet: [0, 5, 37], x: 0, z: 0, y: 20, heading: 0 });
      app.worlds.set(w.id, w);
      await page.addInitScript(
        ({ token, id }) => {
          localStorage.setItem('aclone.pilot', token);
          localStorage.setItem('aclone.world', id);
          localStorage.setItem('aclone.quality', 'low');
          localStorage.setItem('aclone.sound', 'off');
          const counts = { shaders: 0, umbrellaAtlas: 0, sources: [] as string[] };
          (window as any).__actorWarmup = counts;
          const compile = WebGL2RenderingContext.prototype.compileShader;
          WebGL2RenderingContext.prototype.compileShader = function (shader) {
            counts.shaders++;
            counts.sources.push(this.getShaderSource(shader)!);
            return compile.call(this, shader);
          };
          const fill = CanvasRenderingContext2D.prototype.fillRect;
          CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
            if (
              this.canvas.width === 1024 &&
              this.canvas.height === 1024 &&
              width === 1024 &&
              height === 1024
            )
              counts.umbrellaAtlas++;
            return fill.call(this, x, y, width, height);
          };
        },
        { token, id: w.id },
      );
      await page.route('**/src/client/main.ts', async (route) => {
        const response = await route.fetch();
        await route.fulfill({
          response,
          body:
            (await response.text()) +
            `
window.__actorScene = scene;
window.__preparationFrames = [];
const originalFrame = scene.frame.bind(scene);
scene.frame = (preparing, displayTime) => {
  if (!preparing) return originalFrame(preparing, displayTime);
  const realNow = performance.now;
  const now = realNow.call(performance);
  // Browser clocks may return the same timestamp throughout synchronous work.
  // Exercise that permitted boundary without sleeping or delaying the journey.
  if (${startupGap}) {
    scene.lastTime = now - 1500;
    performance.now = () => now;
  }
  const before = { gap: performance.now() - scene.lastTime, fog: !!scene.scene.fog, hidden: document.hidden };
  try { originalFrame(preparing, displayTime); }
  finally { if (${startupGap}) performance.now = realNow; }
  window.__preparationFrames.push({ ...before, fogAfter: !!scene.scene.fog });
};`,
        });
      });
      await page.goto('http://127.0.0.1:' + (await app.listen()));
      await waitForWorld(page);
      const before = await page.evaluate(() => ({ ...(window as any).__actorWarmup }));
      const q = addPlayer(w, 'local-first-walker', 'Rain walker');
      Object.assign(q, { vehicle: 5, online: true, x: 3, z: 7, y: 20, heading: Math.PI });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const mesh = (window as any).__actorScene.meshes.get('local-first-walker');
            return mesh?.visible && mesh.userData.umbrella?.openness > 0.99;
          }),
        )
        .toBeTruthy();
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ ...(window as any).__actorWarmup }));
      mkdirSync('output/automotive-factory/warmup', { recursive: true });
      await page.screenshot({ path: 'output/automotive-factory/warmup/rain-walker.png' });
      writeFileSync(
        `output/automotive-factory/warmup/shaders-${test.info().repeatEachIndex}.json`,
        JSON.stringify({ before, after }),
      );
      const preparation = await page.evaluate(() => (window as any).__preparationFrames);
      const preparationPath = testInfo.outputPath('actor-preparation.json');
      writeFileSync(preparationPath, JSON.stringify({ before, after, preparation }));
      await testInfo.attach('actor-preparation.json', {
        path: preparationPath,
        contentType: 'application/json',
      });
      await testInfo.attach('rain-walker.png', {
        path: 'output/automotive-factory/warmup/rain-walker.png',
        contentType: 'image/png',
      });
      if (startupGap) {
        expect(preparation.length).toBeGreaterThanOrEqual(2);
        expect(preparation.every((f: any) => f.gap >= 1500 && !f.hidden)).toBe(true);
      }
      expect(
        after.shaders - before.shaders,
        'no first-use walking or umbrella shaders during play',
      ).toBe(0);
      expect(
        after.umbrellaAtlas - before.umbrellaAtlas,
        'umbrella atlas must exist before input is enabled',
      ).toBe(0);
      expect(preparation.every((f: any) => f.fogAfter)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
