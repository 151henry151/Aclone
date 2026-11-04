// SPDX-License-Identifier: GPL-3.0-or-later
/** Isolated 66 mph rendering path. No account, network game or production state. */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const out = process.env.PROFILE_OUT ?? 'output/flight-view';
mkdirSync(out, { recursive: true });
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as any).__name = (v: unknown) => v;
    localStorage.setItem('aclone.quality', 'low');
    localStorage.setItem('aclone.sound', 'off');
  });
  await page.route('**/__flight-profile', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld,addPlayer} from '/src/shared/simulation.ts';
      import {defaultCreator} from '/src/shared/creator.ts';
      import {flightState} from '/src/shared/flight.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      const w=createWorld('puddlewick','Flight profile','server');
      w.settings.mapSize=12500;w.terrainMapSize=12500;
      w.settings.time=43200;w.settings.dayLength=0;w.climate={snow:0,snowDepth:0,wetness:0};
      w.creator={...defaultCreator(),weather:'clear'};
      const p=addPlayer(w,'profile','Pilot');
      const speed=66*.44704,heading=-Math.PI/4;
      Object.assign(p,{vehicle:2,online:true,engine:true,x:1300,z:-1300,y:120,speed,heading});
      Object.assign(flightState(p,terrainHeight(w,p.x,p.z)),{grounded:false,vx:Math.sin(heading)*speed,vz:Math.cos(heading)*speed,vy:0,bank:0,pitch:0,throttle:.5});
      const game=new GameScene(document.getElementById('view'));game.cameraMode=1;
      const frames=[];const render=game.renderer.render.bind(game.renderer);
      game.renderer.render=(...args)=>{frames.push(performance.now());render(...args);};
      game.setWorld(w,p.id);
      window.fixture={w,p,game,frames};
      window.runPath=async()=>{
        const start=performance.now();frames.length=0;let last=0;
        await new Promise(resolve=>{
          function frame(){
            const seconds=(performance.now()-start)/1000;
            if(seconds>=45){resolve();return;}
            if(seconds-last>=.1){last=seconds;p.x=1300+p.flight.vx*seconds;p.z=-1300+p.flight.vz*seconds;w.time=seconds;game.setWorld(w,p.id);}
            requestAnimationFrame(frame);
          }frame();
        });
        const gl=game.renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
        const intervals=frames.slice(1).map((at,i)=>at-frames[i]).sort((a,b)=>a-b);
        const percentile=q=>intervals[Math.floor((intervals.length-1)*q)];
        return {renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unknown',frames:frames.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),draws:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles,tiles:game.ground.meshes.length,fog:{near:game.scene.fog.near,far:game.scene.fog.far},pixelRatio:game.renderer.getPixelRatio(),path:{from:[1300,120,-1300],to:[p.x,p.y,p.z],mph:66,seconds:45}};
      };
      </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__flight-profile');
  await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
    timeout: 300000,
  });
  await page.screenshot({ path: out + '/start.png' });
  const result = await page.evaluate(() => (window as any).runPath());
  await page.screenshot({ path: out + '/end.png' });
  writeFileSync(out + '/results.json', JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }));
  if (errors.length) throw Error(errors.join('\n'));
  assert.doesNotMatch(result.renderer, /swiftshader|llvmpipe|softpipe|software/i);
  assert.ok(result.p50 <= 50 && result.p95 <= 1000 / 15, 'Performance frame-time budget');
  if (process.env.PROFILE_BASELINE) {
    const baseline = JSON.parse(readFileSync(process.env.PROFILE_BASELINE, 'utf8'));
    assert.equal(result.renderer, baseline.renderer, 'compare the same hardware');
    assert.ok(result.p50 <= baseline.p50 * 1.1, 'median regression exceeds 10%');
    assert.ok(result.p95 <= baseline.p95 * 1.1, 'p95 regression exceeds 10%');
  }
} finally {
  await browser.close();
  await server.close();
}
