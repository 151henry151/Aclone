// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { createWorld, makeBuilding } from '../src/shared/simulation';

// Private captures are optional local input only; never copy their contents into reports.
const capture = process.env.PROFILE_WORLD_FILE
  ? JSON.parse(readFileSync(process.env.PROFILE_WORLD_FILE, 'utf8'))
  : undefined;
const world = capture?.world ?? createWorld('revision-test', 'Revision test', 'owner');
if (!capture) {
  world.settings.mapSize = 12500;
  world.roads = Array.from({ length: 1479 }, (_, i) => ({
    a: { x: (i % 50) * 16 - 400, z: Math.floor(i / 50) * 24 - 400 },
    b: { x: (i % 50) * 16 - 384, z: Math.floor(i / 50) * 24 - 400 },
    width: 6,
  }));
  world.buildings = Array.from({ length: 77 }, (_, i) =>
    makeBuilding(`house-${i}`, 'home', (i % 11) * 40 - 200, Math.floor(i / 11) * 48 - 200),
  );
}
world.players = {};
if (process.env.PROFILE_START_SNOW) world.climate = { snow: 1, snowDepth: 0.2, wetness: 0 };
const position = capture?.pilots?.find(
  (p: { name: string }) => p.name === process.env.PROFILE_PILOT,
);
const encodedWorld = JSON.stringify(world).replaceAll('<', '\\u003c');
const out = process.env.PROFILE_OUT ?? 'output/world-revision-performance';
mkdirSync(out, { recursive: true });
const server = await createServer({
  root: resolve('.'),
  configFile: false,
  define: { __ACLONE_BASE__: JSON.stringify('/') },
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
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  page.on('console', (m) => {
    if (m.text().startsWith('LOAD')) console.log(m.text());
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.addInitScript(() => {
    (window as any).__name = (v: unknown) => v;
    (window as any).__ACLONE_BASE__ = '/';
    localStorage.setItem('aclone.quality', 'low');
    localStorage.setItem('aclone.sound', 'off');
  });
  await page.route('**/__revision', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html>
<link rel="stylesheet" href="/src/client/style.css"><style>#view{width:100vw;height:100vh}#map{position:absolute;inset:20px;display:none;background:#243e31}</style><div id="view"></div><div id="map"></div>
<script type="module">
import {GameScene} from '/src/client/scene.ts';
import {ParishMap} from '/src/client/parish-map.ts';
import {addPlayer} from '/src/shared/simulation.ts';
import {terrainHeight} from '/src/shared/terrain.ts';
const w=${encodedWorld}, p=addPlayer(w,'diagnostic','Diagnostic');
Object.assign(p,{x:${position?.x ?? 0},z:${position?.z ?? 0},vehicle:0,engine:false,online:true});
p.y=terrainHeight(w,p.x,p.z);
const game=new GameScene(document.getElementById('view'));
game.onLoading=s=>console.log('LOAD '+s);
const build=game.buildWorld.bind(game);game.buildWorld=function*(snapshot){const start=performance.now();yield* build(snapshot);window.lastBuildMs=performance.now()-start;window.renderedName=snapshot.buildings[0]?.name};
const frames=[],tasks=[];let collecting=false;
const render=game.renderer.render.bind(game.renderer);
game.renderer.render=(...args)=>{if(collecting && game.renderer.getRenderTarget()===null)frames.push(performance.now());return render(...args)};
new PerformanceObserver(l=>{if(collecting)tasks.push(...l.getEntries().map(e=>e.duration))}).observe({type:'longtask'});
game.setWorld(w,p.id);window.f={w,p,game};
window.run=async(name)=>{
 frames.length=tasks.length=0;collecting=true;
 await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
 const oldTiles=game.ground.meshes.slice(), oldLand=game.land;
 if(name==='road'||name==='snow-road'||name==='supersede'){
   const r=w.roads[w.roads.length-1]; w.roads=[...w.roads,{a:{...r.b},b:{x:r.b.x+8,z:r.b.z+8},width:r.width}];
 } else if(name==='building'){w.buildings=[...w.buildings];w.buildings[0]={...w.buildings[0],name:'Changed house',construction:{logs:1}}}
 else if(name==='snow'){w.climate={snow:1,snowDepth:.2,wetness:0}}
 else if(name==='thaw'){w.climate={snow:0,snowDepth:0,wetness:0}}
 else if(name==='map'){const h=document.getElementById('map');h.style.display='block';window.map=new ParishMap(h,w,p)}
 const start=performance.now();game.setWorld(w,p.id);const snapshot=performance.now()-start;
 const retained=oldTiles.length>0&&oldTiles.every(t=>game.ground.group.children.includes(t));
 if(name==='supersede'){await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);w.buildings[0]={...w.buildings[0],name:'Newest house'};game.setWorld(w,p.id)}
 const began=performance.now();let last=began;
 while(performance.now()-began<12000 || game.worldBuild || game.snowJob){
   await new Promise(requestAnimationFrame);
   if(performance.now()-began>90000)throw Error('Revision never finished');
   if(performance.now()-last>100){last=performance.now();w.time+=.1;if(name==='move'){p.x+=1;p.y=terrainHeight(w,p.x,p.z)}game.setWorld(w,p.id)}
 }
 const lastFrame=frames.length;while(frames.length===lastFrame)await new Promise(requestAnimationFrame);
 collecting=false;const gaps=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
 return {name,snapshot,retained,buildMs:window.lastBuildMs,geometries:game.renderer.info.memory.geometries,textures:game.renderer.info.memory.textures,replaced:game.land!==oldLand,renderedName:window.renderedName,frames:frames.length,p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1),over100:gaps.filter(t=>t>100).length,tasks,tiles:game.ground.meshes.length,snow:!!game.snowDetails,snowVisible:game.snowDetails?.group.visible,snowPrepared:game.snowPrepared,snowMeshes:game.snowDetails?.group.children.length,draws:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles};
};
</script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__revision');
  await Promise.race([
    page.waitForFunction(() => (window as any).f?.game.ready, null, { timeout: 300000 }),
    page.waitForEvent('pageerror').then((e) => {
      throw e;
    }),
  ]);
  await page.waitForTimeout(3000);
  if (process.env.PROFILE_START_SNOW)
    assert.equal(
      await page.evaluate(() => (window as any).f.game.snowDetails.group.visible),
      true,
      'cold winter entry shows the prepared snow',
    );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  if (process.env.PROFILE_CPU) await cdp.send('Profiler.enable');
  const results: unknown[] = [];
  for (const name of (
    process.env.PROFILE_CASES ?? 'road,building,supersede,snow,snow-road,thaw,move,map'
  ).split(',')) {
    if (process.env.PROFILE_CPU) await cdp.send('Profiler.start');
    const row = await page.evaluate((name) => (window as any).run(name), name);
    if (process.env.PROFILE_CPU) {
      const { profile } = await cdp.send('Profiler.stop');
      writeFileSync(`${out}/${name}.cpuprofile`, JSON.stringify(profile));
    }
    const { metrics } = await cdp.send('Performance.getMetrics');
    row.heapMiB = metrics.find((m) => m.name === 'JSHeapUsedSize')!.value / 1048576;
    results.push(row);
    writeFileSync(`${out}/results.json`, JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify(row));
    await page.screenshot({ path: `${out}/${name}.png` });
    assert.ok(row.snapshot < 50, `${name}: snapshot blocked for ${row.snapshot.toFixed(1)} ms`);
    if (['road', 'building', 'supersede', 'snow-road'].includes(name))
      assert.ok(row.retained, `${name}: existing terrain was cleared`);
    if (['road', 'building', 'supersede', 'snow-road'].includes(name))
      assert.ok(row.replaced, `${name}: replacement never appeared`);
    if (name === 'building') assert.equal(row.renderedName, 'Changed house');
    if (name === 'supersede') assert.equal(row.renderedName, 'Newest house');
    if (name === 'snow' || name === 'snow-road') {
      assert.equal(row.snowPrepared, true);
      assert.ok(row.snowMeshes > 0);
      assert.equal(row.snowVisible, true);
    }
    if (name === 'thaw') assert.equal(row.snowVisible, false);
    assert.ok(
      row.tasks.every((ms: number) => ms <= 100),
      `${name}: main-thread task exceeded 100 ms: ${row.tasks}`,
    );
    assert.equal(errors.length, 0, errors.join('\n'));
  }
} finally {
  await browser.close();
  await server.close();
}
