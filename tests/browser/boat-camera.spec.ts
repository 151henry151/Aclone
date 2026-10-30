// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
test('actual chase camera stays above offshore water after orbiting and smoothing', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__boat-camera', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
    globalThis.__ACLONE_BASE__='/';
    import {GameScene} from '/src/client/scene.ts';
    import {createWorld,addPlayer} from '/src/shared/simulation.ts';
    import {defaultCreator} from '/src/shared/creator.ts';
    const w=createWorld('puddlewick','Puddlewick','server');
    w.settings.mapSize=18500;w.terrainMapSize=12500;w.buildings=[];w.roads=[];
    w.creator={...defaultCreator(),scenery:false};
    const p=addPlayer(w,'camera','Camera');Object.assign(p,{vehicle:30,x:0,z:6500,y:w.settings.seaLevel,online:true});
    const game=new GameScene(document.getElementById('view'));game.setWorld(w,p.id);
    window.checkCamera=()=>{
      game.renderer.setAnimationLoop(null);game.cameraMode=0;game.lookPitch=1.4;game.zoom=3;
      const render=game.renderer.render.bind(game.renderer);game.renderer.render=()=>{};
      const heights=[];
      for(const slot of [30,3,29]) for(const orbit of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
        p.vehicle=slot;game.setWorld(w,p.id);game.orbit=orbit;game.camera.position.set(0,w.settings.seaLevel-20,6500);
        game.meshes.get(p.id).userData.snapCamera=false;game.renderTime=0;game.lastTime=performance.now()-16;
        game.frame(true);heights.push(game.camera.position.y-w.settings.seaLevel);
      }
      game.renderer.render=render;render(game.scene,game.camera);return heights;
    };
    window.checkResume=()=>{
      p.vehicle=30;p.x=0;p.z=6500;game.setWorld(w,p.id);
      game.cameraMode=0;game.lookPitch=0;game.zoom=1;game.orbit=0;
      game.camera.position.set(-900,25,6100);
      game.resumeMotion();
      p.x=300;w.time+=30;game.setWorld(w,p.id);
      game.prediction.receive(w,p,0,0,performance.now());
      game.renderTime=0;game.lastTime=performance.now()-16;game.frame(true);
      return {gap:Math.hypot(game.camera.position.x-p.x,game.camera.position.z-p.z),actor:game.meshes.get(p.id).position.x,predicted:game.prediction.sample(performance.now(),{throttle:0,steer:0,boost:false}).x};
    };
    window.cameraReady=()=>game.ready;
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__boat-camera');
    await page.waitForFunction(() => (window as any).cameraReady?.(), undefined, {
      timeout: 90000,
    });
    const heights = await page.evaluate(() => (window as any).checkCamera());
    expect(heights).toHaveLength(12);
    for (const y of heights) expect(y).toBeGreaterThanOrEqual(0.599);
    await page.screenshot({ path: 'test-results/boat-lowest-camera.png' });
    const resume = await page.evaluate(() => (window as any).checkResume());
    expect(resume.gap).toBeLessThan(100);
    expect(resume.actor).toBeCloseTo(300);
    expect(resume.predicted).toBeCloseTo(300);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
