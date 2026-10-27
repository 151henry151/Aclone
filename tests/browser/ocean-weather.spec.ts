import { oceanPreviewHTML } from '../../scripts/ocean-preview-scene';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

test('actual ocean renders deep extinction, calm/storm swells and tide-aware boat cameras', async ({
  page,
}) => {
  test.setTimeout(180000);
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__ocean', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: oceanPreviewHTML,
      }),
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(server.resolvedUrls!.local[0] + '__ocean');
    await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 100000 });
    const show = (mode: string, time: number) =>
      page.evaluate(([mode, time]) => (window as any).showOcean(mode, time), [mode, time] as const);
    await page.evaluate(() => (window as any).prepareOcean());
    const calm = await show('clear', 0);
    expect(calm.amplitude).toBeLessThan(0.01);
    mkdirSync('output/ocean', { recursive: true });
    await page.screenshot({ path: 'output/ocean/calm.png' });
    const heights: number[] = [];
    for (let i = 0; i < 40; i++) {
      const s = await show('storm', i * 0.15);
      heights.push(s.height);
      expect(s.camera).toBeGreaterThan(s.surface + 0.59);
      expect(Number.isFinite(s.pitch) && Number.isFinite(s.roll)).toBeTruthy();
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(1);
    const trailingHeight = await page.evaluate(() => {
      const game = (window as any).game;
      const net = game.scene.getObjectByName('Open mouth, tapered belly and closed codend');
      const points = net.geometry.attributes.position;
      let highest = -Infinity;
      for (let i = 0; i < points.count; i++) {
        if (points.getZ(i) > -25) continue;
        const point = net.position.clone().fromBufferAttribute(points, i);
        net.localToWorld(point);
        highest = Math.max(highest, point.y - game.ocean.height(point.x, point.z));
      }
      return highest;
    });
    expect(Number.isFinite(trailingHeight)).toBeTruthy();
    expect(trailingHeight).toBeLessThan(0.2);
    await page.screenshot({ path: 'output/ocean/storm.png' });
    const cockpit = await show('cockpit', 5);
    expect(cockpit.camera).toBeGreaterThan(cockpit.surface + 0.59);
    await show('shore', 4);
    await page.screenshot({ path: 'output/ocean/shore.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});

test('underwater contrast fades with depth and distant seabed is fully obscured', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  try {
    await page.route('**/__extinction', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {Ocean} from '/src/client/ocean.ts';
 import {createWorld} from '/src/shared/simulation.ts';
 const w=createWorld('optics','Optics','server');w.settings.seaLevel=0;w.settings.oceanWaves=0;
 const ocean=new Ocean(),scene=new T.Scene();scene.add(ocean.create(w,true));ocean.update(w,0,6500,0,0,1);
 const positions=[[-10,-1],[0,-8],[10,-30]];
 for(const [x,y] of positions){const cube=new T.Mesh(new T.BoxGeometry(3,1,3),new T.MeshBasicMaterial({color:'white'}));cube.position.set(x,y,6500);scene.add(cube);ocean.absorb(cube);}
 scene.add(new T.HemisphereLight(0xffffff,0x446666,2));
 const camera=new T.OrthographicCamera(-20,20,20,-20,.1,100);camera.position.set(0,40,6500);camera.up.set(0,0,-1);camera.lookAt(0,0,6500);
 const renderer=new T.WebGLRenderer();renderer.setSize(300,300);const target=new T.WebGLRenderTarget(300,300);renderer.setRenderTarget(target);renderer.render(scene,camera);
 const read=x=>{const pixel=new Uint8Array(4);renderer.readRenderTargetPixels(target,x,150,1,1,pixel);return Array.from(pixel).slice(0,3);};
 window.result=[read(75),read(150),read(225),read(265)];
 renderer.dispose();target.dispose();
 </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__extinction');
    await page.waitForFunction(() => (window as any).result);
    const [near, middle, deep, background] = (await page.evaluate(
      () => (window as any).result,
    )) as number[][];
    const contrast = (a: number[]) => a.reduce((n, c, i) => n + Math.abs(c - background[i]), 0);
    expect(contrast(near)).toBeGreaterThan(contrast(middle) + 20);
    expect(contrast(middle)).toBeGreaterThan(contrast(deep));
    expect(contrast(deep)).toBeLessThan(4);
  } finally {
    await page.close();
    await server.close();
  }
});
