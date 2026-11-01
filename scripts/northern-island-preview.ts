// SPDX-License-Identifier: GPL-3.0-or-later
/** Disposable preview of the actual generated world, map and game renderer. */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
import { RIVER_DOCK, riverDockSite } from '../src/shared/river-dock';
import { constructionSiteReason, foundationProfile } from '../src/shared/construction-site';
const dir = 'output/northern-island';
mkdirSync(dir, { recursive: true });
const w = createWorld('puddlewick', 'Puddlewick', 'server');
w.settings.mapSize = 18500;
w.terrainMapSize = 12500;
w.townLayout = 2;
const original = structuredClone(w);
expandPuddlewickIsland(w);
/** A completed river dock on the first usable lower reach of the Alder River. */
const dock = (() => {
  const r = w.northernIsland!.rivers[0],
    banks = riverBanks(r.points);
  for (let i = Math.floor(r.points.length * 0.55); i < r.points.length - 3; i++)
    for (const side of ['left', 'right'] as const) {
      const p = r.points[i],
        bank = banks[i][side],
        d = Math.hypot(bank.x - p.x, bank.z - p.z) || 1,
        nx = (bank.x - p.x) / d,
        nz = (bank.z - p.z) / d;
      const b = makeBuilding('river-dock', RIVER_DOCK, bank.x + nx * 3.5, bank.z + nz * 3.5);
      b.rotation = Math.atan2(nx, nz);
      b.owner = 'preview';
      b.foundationY = foundationProfile(w, b).level;
      const site = riverDockSite(w, b);
      if (site && !constructionSiteReason(w, b)) return { b, site };
    }
  throw Error('No usable river dock site');
})();
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: process.env.MAP_ONLY
    ? ['--no-sandbox']
    : process.env.PREVIEW_GPU
      ? ['--no-sandbox', '--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : [
          '--no-sandbox',
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
        ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  page.on('console', (m) => {
    if (m.text().startsWith('LOAD')) console.log(m.text());
    if (m.type() === 'error') {
      errors.push(m.text());
      console.error(m.text().slice(0, 1500));
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('aclone.quality', 'low');
    localStorage.setItem('aclone.sound', 'off');
  });
  await page.route('**/__island', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<html><head><meta charset="utf-8"><link rel="stylesheet" href="/src/client/style.css"><style>body{margin:0}#view{width:100vw;height:100vh}#map{display:none;position:absolute;inset:35px 70px;background:#243e31;padding:28px;border:1px solid #8a987c;border-radius:10px}#map .parish-map-viewport{height:740px;max-height:none}#map-title{margin:0 0 12px;color:#efe8ca;font:22px Georgia}#caption{position:absolute;bottom:30px;left:35px;color:#f2edce;font:20px Georgia;text-shadow:0 2px 4px #000;pointer-events:none}#caption small{display:block;font:12px monospace;margin-top:8px}</style></head><body><div id="view"></div><div id="map"></div><div id="caption"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';import {GameScene} from '/src/client/scene.ts';import {ParishMap} from '/src/client/parish-map.ts';
 import {defaultCreator} from '/src/shared/creator.ts';import {addPlayer} from '/src/shared/simulation.ts';import {terrainHeight} from '/src/shared/terrain.ts';import {riverBanks} from '/src/shared/inland-water.ts';
 const w=${JSON.stringify(w)};w.settings.time=40000;w.settings.dayLength=0;w.time=90*600;w.climate={snow:0,wetness:0};w.creator=defaultCreator();w.creator.weather='clear';
 const r=w.northernIsland.rivers[0];const p=addPlayer(w,'preview','Explorer');Object.assign(p,{x:r.points[60].x+20,z:r.points[60].z,vehicle:0,online:true,engine:false,lights:false});p.y=terrainHeight(w,p.x,p.z);
 const original=${JSON.stringify(original)};const savedBuildings=w.buildings;w.buildings=[];const game=${process.env.MAP_ONLY ? 'null' : "new GameScene(document.getElementById('view'))"};if(game){game.onLoading=(message)=>console.log('LOAD '+message);game.setWorld(w,p.id);}window.ready=()=>game?.ready??true;window.game=game;
 window.show=async(kind)=>{game.renderer.setAnimationLoop(null);document.getElementById('map').style.display='none';
 let point,cam,target,caption;
 if(kind==='headwaters'){point=r.points[20];cam=[point.x+105,point.level+45,point.z+90];target=[point.x-15,point.level+4,point.z-40];caption='Mountain headwaters · tractor-fordable shallows';}
 if(kind==='river'){point=r.points[Math.floor(r.points.length*.57)];cam=[point.x+130,point.level+90,point.z+160];target=[point.x-70,point.level,point.z-100];caption='Alder River · a widening valley through the northern forests';}
 if(kind==='bank'){point=r.points[Math.floor(r.points.length*.57)];cam=[point.x+35,point.level+8,point.z+30];target=[point.x-15,point.level+1,point.z-25];caption='Alder River · riverbank and moving water';}
 if(kind==='mountain'){point=r.points[30];cam=[point.x+230,point.level+180,point.z+100];target=[w.northernIsland.mountain.x,w.northernIsland.mountain.height-100,w.northernIsland.mountain.z];caption='The northern mountain · headwaters begin below the summit';}
 if(kind==='pond'){point=w.northernIsland.ponds[3];cam=[point.x+180,point.level+100,point.z+160];target=[point.x,point.level,point.z];caption='Northern pond country · woodland and sheltered water';}
 if(kind==='coast'){const b=w.coastalBluffs.find(b=>b.width>600);point={x:b.x,z:b.z,level:0};cam=[b.x+Math.sin(b.angle)*250,b.height+120,b.z+Math.cos(b.angle)*250];target=[b.x,b.height*.4,b.z];caption='Rocky headlands · long cliff coasts and sea stacks';}
 if(kind==='dock'){const d=${JSON.stringify(dock.b)},s=${JSON.stringify(dock.site)};w.buildings=[d];w.mooredBoats={'preview:3':{owner:'preview',slot:3,x:s.berth.x,z:s.berth.z,heading:s.heading,paint:'blue',landing:d.id}};point={x:d.x,z:d.z,level:s.level};const ux=(s.berth.x-d.x)/13.2,uz=(s.berth.z-d.z)/13.2;cam=[d.x+ux*30-uz*22,s.level+9,d.z+uz*30+ux*22];target=[d.x+ux*8,s.level+0.5,d.z+uz*8];caption='River dock · a log jetty with a moored canal boat on a navigable reach';}
 else w.buildings=[];
 const ri=r.points.indexOf(point);const bank=ri>=0?riverBanks(r.points)[ri].left:null;const reach=bank?Math.hypot(bank.x-point.x,bank.z-point.z):1;p.x=bank?bank.x+(bank.x-point.x)/reach*5:point.x+15;p.z=bank?bank.z+(bank.z-point.z)/reach*5:point.z;p.y=terrainHeight(w,p.x,p.z);p.heading=Math.atan2(target[0]-p.x,target[2]-p.z);
 game.setWorld(w,p.id);
 for(let i=0;i<6000;i++){const ground=game.ground.update(point.x,point.z,12),woods=game.woods.update(point.x,point.z,12),horizon=game.horizon.prepare(12);if(!ground&&!woods&&!horizon)break;await new Promise(r=>setTimeout(r,0));if(i===5999)throw Error('Terrain failed to settle');}
 game.lastTime=performance.now()-34;game.renderTime=-Infinity;game.frame(true);game.camera.position.set(...cam);game.camera.lookAt(...target);game.sky.position.copy(game.camera.position);game.horizon.update(w,game.camera,game.ground,game.ocean.level.value,1);game.renderer.render(game.scene,game.camera);
 document.getElementById('caption').innerHTML=caption+'<small>Aclone · northern island expansion · unreleased game preview</small>';
 const ray=new T.Raycaster(new T.Vector3(point.x,point.level+2000,point.z),new T.Vector3(0,-1,0));game.scene.updateMatrixWorld(true);const hits=ray.intersectObjects([game.ground.group,game.inland.group,game.horizon.group],true).slice(0,8).map(h=>({y:h.point.y,type:h.object.parent===game.inland.group?'water/bank':h.object.parent===game.horizon.group?'horizon':'ground'}));
 if(Math.hypot(game.inland.centre.value.x-p.x,game.inland.centre.value.y-p.z)>1)throw Error('Water visibility has not caught up to camera');
 if(ri>=0){const ground=hits.find(h=>h.type==='ground'),water=hits.find(h=>h.type==='water/bank');if(!ground||!water||ground.y>=water.y)throw Error('River is below rendered terrain');}
 return {point,hits,me:{x:game.me.x,z:game.me.z},centre:game.inland.centre.value,waterVisible:game.inland.group.visible,ground:terrainHeight(w,point.x,point.z),draws:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles};};
 window.mapShot=async(kind='island')=>{game?.renderer.setAnimationLoop(null);document.getElementById('map').style.display='block';document.getElementById('caption').innerHTML='';
 w.buildings=savedBuildings;window.chart?.dispose();const host=document.getElementById('map');host.replaceChildren();
 const view={island:{x:0,z:-14500,scale:.016,title:'Northern expansion · full island'},watershed:{x:w.northernIsland.mountain.x,z:w.northernIsland.mountain.z,scale:.045,title:'Mountain watershed · five rivers flowing toward the coast'},south:{x:0,z:2500,scale:.10,title:'Preserved southern peninsula · after expansion'},'old-south':{x:0,z:2500,scale:.10,title:'Original southern peninsula · before expansion'},river:{x:r.points[Math.floor(r.points.length*.57)].x,z:r.points[Math.floor(r.points.length*.57)].z,scale:.35,title:'Alder River · bends, valley contours and surrounding hills'}}[kind];
 const world=kind==='old-south'?original:w;const pilot={...p,x:0,z:0};const map=new ParishMap(host,world,pilot);const heading=document.createElement('div');heading.id='map-title';heading.textContent=view.title;host.prepend(heading);map.zoom=view.scale/map.unitScale();map.bounds=map.frame(view);map.draw();map.panTo(view.x,view.z);window.chart=map;return map.terrainSerial;};
 </script></body></html>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__island');
  await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 300000 });
  for (const name of process.env.MAP_ONLY
    ? []
    : (process.env.SHOTS?.split(',') ?? ['headwaters', 'river', 'mountain', 'pond', 'coast'])) {
    console.log(name, await page.evaluate((name) => (window as any).show(name), name));
    await page.screenshot({ path: dir + '/' + name + '.png', timeout: 120000 });
  }
  await page.evaluate(() => (window as any).mapShot());
  await page.waitForFunction(
    () => document.querySelector('.map-terrain')?.getAttribute('data-rendered-job'),
    undefined,
    { timeout: 60000 },
  );
  console.log(
    'MAP',
    await page.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      nodes: document.querySelectorAll('*').length,
      html: document.documentElement.outerHTML.length,
    })),
  );
  await page.screenshot({ path: dir + '/island-map.png' });
  const overview = await page.evaluate(() => ({
    resources: document.querySelectorAll('.map-resource-dot').length,
    buildings: document.querySelectorAll('.parish-map-building-label').length,
    towns: document.querySelectorAll('.map-town-dot').length,
    names: document.querySelectorAll('.parish-map-town-label').length,
  }));
  if (
    overview.resources ||
    overview.buildings ||
    !overview.towns ||
    overview.towns !== overview.names
  )
    throw Error('Town overview failed: ' + JSON.stringify(overview));
  const local = await page.evaluate(() => {
    const map = (window as any).chart;
    map.zoom = 0.75;
    map.bounds = map.frame({ x: 0, z: 0 });
    map.draw();
    map.panTo(0, 0);
    return {
      resources: document.querySelectorAll('.map-resource-dot').length,
      buildings: document.querySelectorAll('.parish-map-building-label').length,
      towns: document.querySelectorAll('.map-town-dot').length,
    };
  });
  if (!local.resources || !local.buildings || local.towns)
    throw Error('Local detail failed: ' + JSON.stringify(local));
  console.log('Map detail checks', overview, local);
  for (const name of ['watershed', 'river', 'south', 'old-south']) {
    const serial = await page.evaluate((name) => (window as any).mapShot(name), name);
    await page.waitForFunction(
      (serial) =>
        document.querySelector('.map-terrain')?.getAttribute('data-rendered-job') ===
        String(serial),
      serial,
      { timeout: 60000 },
    );
    await page.screenshot({ path: dir + '/map-' + name + '.png' });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
