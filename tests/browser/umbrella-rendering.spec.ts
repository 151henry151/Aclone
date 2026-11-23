// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('a fully detailed folding umbrella uses at most four draws and remains visible in first person', async ({
  page,
}, info) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__umbrella-budget', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
      <style>body{margin:0}canvas{display:block}</style><script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import {createHuman} from '/src/client/human.ts';
      import {createRainUmbrella} from '/src/client/umbrella.ts';
      const scene = new T.Scene();scene.background = new T.Color('#263343');
      const renderer = new T.WebGLRenderer({antialias:true});renderer.setSize(900,700);document.body.append(renderer.domElement);
      scene.add(new T.HemisphereLight('#dce9ff','#4c4b33',1.5));const sun = new T.DirectionalLight('#ffdbac',2);sun.position.set(3,7,5);scene.add(sun);
      const root = new T.Group(),human = createHuman();root.add(human.group);scene.add(root);
      const umbrella = createRainUmbrella(human.group);root.add(umbrella.group);
      const camera = new T.PerspectiveCamera(36,900/700,.05,100);camera.position.set(3.1,3.3,4.8);camera.lookAt(0,1.2,0);
      let draws=0,canopyDrawn=false;umbrella.group.traverse(o=>{if(o.isMesh||o.isLine)o.onBeforeRender=()=>{draws++;if(o===umbrella.fabric)canopyDrawn=true;};});
      window.step=(wet,frames)=>{for(let i=0;i<frames;i++){human.animate(1.3/60,1/60,.002);umbrella.update(wet,1/60);}draws=0;renderer.render(scene,camera);return {draws,open:umbrella.openness,triangles:renderer.info.render.triangles,contextLost:renderer.getContext().isContextLost()};};
      window.away=()=>{camera.position.set(0,3,10);camera.lookAt(0,3,20);draws=0;renderer.render(scene,camera);return draws;};window.eye=()=>{human.group.visible=false;camera.position.set(0,1.66,.12);camera.lookAt(0,1.75,5);draws=0;canopyDrawn=false;renderer.render(scene,camera);return {draws,canopyDrawn};};window.ready=true;
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__umbrella-budget');
    await page.waitForFunction(() => (window as any).ready);
    const opening = await page.evaluate(() => (window as any).step(true, 35));
    await page.locator('canvas').screenshot({ path: info.outputPath('opening.png') });
    const open = await page.evaluate(() => (window as any).step(true, 40));
    await page.locator('canvas').screenshot({ path: info.outputPath('open.png') });
    const eyeDraws = await page.evaluate(() => (window as any).eye());
    await page.locator('canvas').screenshot({ path: info.outputPath('first-person.png') });
    const offscreenDraws = await page.evaluate(() => (window as any).away());
    const closed = await page.evaluate(() => (window as any).step(false, 70));
    for (const name of ['opening', 'open', 'first-person'])
      await info.attach(name, { path: info.outputPath(name + '.png'), contentType: 'image/png' });
    await info.attach('draw-budget', {
      body: JSON.stringify({ opening, open, eyeDraws, offscreenDraws, closed }),
      contentType: 'application/json',
    });
    expect(errors).toEqual([]);
    expect(open.contextLost).toBe(false);
    expect(opening.open).toBeGreaterThan(0);
    expect(opening.open).toBeLessThan(1);
    expect(open.open).toBe(1);
    expect(open.draws).toBeGreaterThan(0);
    expect(eyeDraws.canopyDrawn).toBe(true);
    expect(eyeDraws.draws).toBeGreaterThan(0);
    expect(eyeDraws.draws).toBeLessThanOrEqual(4);
    expect(closed.draws).toBe(0);
    expect(offscreenDraws, 'umbrellas behind the camera need no draw calls').toBe(0);
    expect(
      open.draws,
      'retain every umbrella detail in at most four draw calls',
    ).toBeLessThanOrEqual(4);
  } finally {
    await page.close();
    await server.close();
  }
});
