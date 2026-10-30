// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('offshore views retain supporting land and readable lighthouse flashes at 1 and 30 km', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__coast', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#152e40}#view{width:100vw;height:100vh}#caption{position:absolute;top:20px;left:25px;color:white;font:18px sans-serif;text-shadow:0 1px 3px #000}</style><div id="view"></div><div id="caption"></div><script type="module">
    globalThis.__ACLONE_BASE__='/';
    import * as T from '/node_modules/three/build/three.module.js';
    import {GameScene} from '/src/client/scene.ts';
    import {defaultCreator} from '/src/shared/creator.ts';
    import {createWorld} from '/src/shared/simulation.ts';
    import {ensurePuddlewickLighthouses} from '/src/server/puddlewick-lighthouses.ts';
    import {buildingPlan} from '/src/shared/building-shapes.ts';
    import {earthDrop} from '/src/shared/marine-visibility.ts';
    import {viewFog} from '/src/client/view-distance.ts';
    import {waitForTextures} from '/src/client/materials.ts';
    const w=createWorld('puddlewick','Puddlewick','server');
    w.settings.mapSize=18500;w.terrainMapSize=12500;ensurePuddlewickLighthouses(w);
    w.buildings=w.buildings.filter(b=>b.kind==='lighthouse');w.creator={...defaultCreator(),scenery:false};w.climate={snow:0,snowDepth:0,wetness:0};
    const game=new GameScene(document.getElementById('view'));game.renderer.setAnimationLoop(null);game.buildWorld(w);
    game.space.visible=false;game.land.visible=true;game.actors.visible=false;
    // No detailed tiles: verify the fallback supports the actual lighthouse geometry.
    game.ground.clear();
    while(game.horizon.prepare(8)) await new Promise(r=>requestAnimationFrame(r));
    await waitForTextures();
    const b=w.buildings.find(b=>b.id==='parish-west-light'),bluff=w.coastalBluffs.find(c=>c.id==='cliff-'+b.id),tower=buildingPlan(b).volumes[0];
    const at=new T.Vector3(b.x+tower.x*Math.cos(b.rotation)+tower.z*Math.sin(b.rotation),b.foundationY+tower.eaves+1.45,b.z-tower.x*Math.sin(b.rotation)+tower.z*Math.cos(b.rotation));
    window.drawCoast=(distance,night,peak)=>{
      game.camera.position.set(b.x+Math.sin(bluff.angle)*distance,w.settings.seaLevel+4,b.z+Math.cos(bluff.angle)*distance);
      const target=at.clone();target.y-=earthDrop(distance);game.camera.lookAt(target);game.camera.updateMatrixWorld();
      const delta=game.camera.position.clone().sub(at),angle=Math.atan2(-delta.z,delta.x);
      const time=(angle-b.x*.01-b.rotation+(peak?0:Math.PI))*8/Math.PI+320;
      game.scene.background=new T.Color(night?'#101c29':'#b3c8ce');
      const fog=viewFog({precipitation:'clear',storm:false});game.scene.fog=new T.Fog(game.scene.background,fog.near,fog.far);
      game.sun.intensity=night?.05:2;game.ambient.intensity=night?.12:1.4;
      game.ocean.update(w,game.camera.position.x,game.camera.position.z,time,0,night?0:1);
      game.horizon.update(w,game.camera,game.ground,w.settings.seaLevel,night?0:1);
      game.lighthouseLights.update(w,game.camera,time,night?0:1,0,innerHeight);
      game.renderer.render(game.scene,game.camera);
      document.getElementById('caption').textContent=(distance/1000)+' km offshore · '+(night?'night · '+(peak?'flash':'between flashes'):'daylight · distant terrain');
      const signal=game.lighthouseLights.group.children.find(c=>c.name===b.name+' rotating flash');
      const pixel=signal.position.clone().project(game.camera);
      const gl=game.renderer.getContext(),rgba=new Uint8Array(9*9*4);
      gl.readPixels(Math.round((pixel.x+1)/2*gl.drawingBufferWidth)-4,Math.round((pixel.y+1)/2*gl.drawingBufferHeight)-4,9,9,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
      return {opacity:signal.material.opacity,visible:signal.visible,peak:Math.max(...rgba.filter((v,i)=>i%4===0)),triangles:game.renderer.info.render.triangles};
    };window.ready=true;
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__coast');
    await page.waitForFunction(() => (window as any).ready, undefined, { timeout: 90000 });
    for (const distance of [1000, 30000]) {
      const dim = await page.evaluate((d) => (window as any).drawCoast(d, true, false), distance);
      expect(dim.visible, JSON.stringify({ distance, ...dim })).toBe(true);
      expect(dim.opacity).toBeGreaterThan(0.02);
      const bright = await page.evaluate((d) => (window as any).drawCoast(d, true, true), distance);
      expect(bright.opacity).toBeGreaterThan(dim.opacity * 8);
      expect(bright.peak).toBeGreaterThan(dim.peak + 20);
      await page.screenshot({ path: 'test-results/lighthouse-' + distance + '.png' });
    }
    await page.evaluate(() => (window as any).drawCoast(1500, false, false));
    await page.screenshot({ path: 'test-results/coastal-support.png' });
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
