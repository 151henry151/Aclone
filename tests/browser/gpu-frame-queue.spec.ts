// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';
import { waitForWorld } from './fixtures/ready';

test('a busy GPU bounds submitted frames while snapshots continue and resumes with the latest pose', async ({
  page,
}, testInfo) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-gpu-queue-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    const { account, token } = app.universe.register('GPU queue driver');
    const w = createWorld('gpu-queue', 'GPU queue', account.id);
    Object.assign(w, { script: '', towns: [], terrain: [], zones: [], buildings: [] });
    w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
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
    Object.assign(p, { vehicle: 0, x: 0, z: 0, y: 20, engine: false });
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    await page.route('**/src/client/main.ts', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        body: (await response.text()) + '\nwindow.__queueScene = scene;',
      });
    });
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    await page.evaluate(() => {
      const scene = (window as any).__queueScene,
        gl = scene.renderer.getContext();
      const state = ((window as any).__gpuQueueTest = {
        held: true,
        submitted: 0,
        created: 0,
        deleted: 0,
        waits: [] as number[][],
        frames: 0,
      });
      const fence = gl.fenceSync.bind(gl),
        wait = gl.clientWaitSync.bind(gl),
        remove = gl.deleteSync.bind(gl);
      const owned = new Set<WebGLSync>();
      gl.fenceSync = (...args: any[]) => {
        const sync = fence(...args);
        if (sync) {
          owned.add(sync);
          state.created++;
        }
        return sync;
      };
      gl.clientWaitSync = (sync: WebGLSync, flags: number, timeout: number) => {
        state.waits.push([flags, timeout]);
        return state.held && owned.has(sync) ? gl.TIMEOUT_EXPIRED : wait(sync, flags, timeout);
      };
      gl.deleteSync = (sync: WebGLSync) => {
        if (owned.delete(sync)) state.deleted++;
        remove(sync);
      };
      const render = scene.renderer.render.bind(scene.renderer);
      scene.renderer.render = (...args: any[]) => {
        state.submitted++;
        return render(...args);
      };
      (window as any).__queueFrames = (count: number) =>
        new Promise<void>((resolve) => {
          function tick() {
            state.frames++;
            if (--count === 0) resolve();
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        });
    });
    // Let fences from before instrumentation retire, then fill both held slots.
    await expect
      .poll(() => page.evaluate(() => (window as any).__gpuQueueTest.submitted))
      .toBeGreaterThanOrEqual(2);
    await page.evaluate(() => (window as any).__queueFrames(30));
    const held = await page.evaluate(() => structuredClone((window as any).__gpuQueueTest));
    p.x = 20;
    await expect.poll(() => page.evaluate(() => (window as any).__queueScene.me.x)).toBe(20);
    const duringSnapshot = await page.evaluate(() => (window as any).__gpuQueueTest.submitted);
    await page.evaluate(() => {
      (window as any).__gpuQueueTest.held = false;
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).__gpuQueueTest.submitted))
      .toBeGreaterThan(duringSnapshot);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const scene = (window as any).__queueScene;
          return Math.abs(scene.meshes.get(scene.me.id).position.x - scene.me.x);
        }),
      )
      .toBeLessThan(0.1);
    await expect
      .poll(() => page.evaluate(() => (window as any).__gpuQueueTest.deleted))
      .toBeGreaterThan(0);
    const resumed = await page.evaluate(() => structuredClone((window as any).__gpuQueueTest));
    const path = testInfo.outputPath('gpu-queue.json');
    writeFileSync(path, JSON.stringify({ held, duringSnapshot, resumed, errors }));
    await testInfo.attach('gpu-queue.json', { path, contentType: 'application/json' });
    await testInfo.attach('latest-pose.png', {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    expect(held.frames).toBe(30);
    expect(held.submitted).toBeLessThanOrEqual(2);
    expect(duringSnapshot).toBe(held.submitted);
    expect(held.created).toBeGreaterThan(0);
    expect(held.waits.length).toBeGreaterThan(0);
    expect(resumed.waits.every(([flags, timeout]: number[]) => flags === 0 && timeout === 0)).toBe(
      true,
    );
    expect(resumed.deleted).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
