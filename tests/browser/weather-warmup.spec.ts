// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { calendar, worldWeather } from '../../src/shared/environment';
import { waitForWorld } from './fixtures/ready';

test('rain arriving after a clear day has no first-use shaders at night or the following dawn', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-weather-warm-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('Weather driver');
    const w = createWorld('weather-warm', 'Weather warmup', account.id);
    Object.assign(w, { script: '', terrain: [], towns: [], zones: [] });
    w.creator = creatorSchema.parse({ roads: false, scenery: false, weather: 'natural' });
    Object.assign(w.settings, { dayLength: 0, time: 43200, hungerRate: 0, thirstRate: 0 });
    const times: Record<string, number> = {};
    for (
      let time = 0;
      time < 86400 * 20 && (times.clear === undefined || times.rain === undefined);
      time += 600
    ) {
      w.time = time;
      const weather = worldWeather(w, calendar(w).absoluteDay);
      if (!weather.storm && ['clear', 'rain'].includes(weather.precipitation))
        times[weather.precipitation] ??= time;
    }
    expect(times.clear).toBeDefined();
    expect(times.rain).toBeDefined();
    w.time = times.clear;
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, { x: 0, z: 0, vehicle: 0 });
    const walker = addPlayer(w, 'walker', 'Rain walker');
    Object.assign(walker, { online: true, vehicle: 5, x: 3, z: 4 });
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
        (window as any).__weatherShaders = [];
        const original = WebGL2RenderingContext.prototype.compileShader;
        WebGL2RenderingContext.prototype.compileShader = function (shader) {
          (window as any).__weatherShaders.push(this.getShaderSource(shader));
          return original.call(this, shader);
        };
      },
      { token, id: w.id },
    );
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__weatherScene = scene;',
      });
    });
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    const initial = await page.evaluate(() => (window as any).__weatherShaders.length);
    w.settings.time = 0;
    w.time = times.rain;
    await expect
      .poll(() =>
        page.evaluate(() => {
          const s = (window as any).__weatherScene;
          return (
            s.precipitation.mesh.visible &&
            s.meshes.get('walker')?.userData.umbrella.openness > 0.99 &&
            s.world.settings.time === 0
          );
        }),
      )
      .toBeTruthy();
    const night = await page.evaluate(() => (window as any).__weatherShaders.length);
    await page.screenshot({ path: info.outputPath('night-rain.png') });
    w.settings.time = 43200;
    await expect
      .poll(() => page.evaluate(() => (window as any).__weatherScene.sun.intensity))
      .toBeGreaterThan(0.5);
    const sources = await page.evaluate(() => (window as any).__weatherShaders);
    const data = info.outputPath('weather-shaders.json');
    writeFileSync(data, JSON.stringify({ initial, night, sources }));
    await info.attach('weather-shaders', { path: data, contentType: 'application/json' });
    await info.attach('night-rain', {
      path: info.outputPath('night-rain.png'),
      contentType: 'image/png',
    });
    expect(errors).toEqual([]);
    expect(night - initial, 'no synchronous shader compilation when rain starts at night').toBe(0);
    expect(sources.length - night, 'no new rain variants on the following day').toBe(0);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
