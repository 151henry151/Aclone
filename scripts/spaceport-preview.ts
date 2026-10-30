// SPDX-License-Identifier: GPL-3.0-or-later
// Render the exact site, terrain and game models; no production connection or mutation.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createWorld } from '../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../src/server/puddlewick-spaceport';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/spaceport-complex';
mkdirSync(output, { recursive: true });
const w = createWorld('puddlewick', 'Puddlewick', 'server', 'economy');
w.settings.mapSize = 18500;
w.terrainMapSize = 12500;
ensurePuddlewickSpaceport(w);
assert.equal(w.spaceportSite?.layout, 3);
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/__spaceport_preview', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}header{position:absolute;top:24px;left:30px;color:#f8f4df;text-shadow:0 2px 5px #172b35;font:26px Georgia}small{display:block;font:15px sans-serif;margin-top:8px}</style><header id="title"></header><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {spaceportComplex} from '/src/client/spaceport-complex.ts';
 import {spaceportFence} from '/src/client/spaceport-fence.ts';
 import {buildingModel} from '/src/client/buildings.ts';
 import {terrainHeight} from '/src/shared/terrain.ts';
 import {spaceportPoint} from '/src/shared/spaceport-site.ts';
 import {freezeScenery} from '/src/client/static-scene.ts';
 import {addPlayer,move} from '/src/shared/simulation.ts';
 import {createHuman} from '/src/client/human.ts';
 const w=${JSON.stringify(w)},s=w.spaceportSite;
 const scene=new T.Scene();scene.background=new T.Color('#91b4c7');scene.fog=new T.Fog('#91b4c7',1800,4000);
 scene.add(new T.HemisphereLight('#ecf4fa','#68705a',2.3));const sun=new T.DirectionalLight('#fff0d0',3);sun.position.set(-500,700,400);scene.add(sun);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1000);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(48,1.6,.1,6000),complex=spaceportComplex(w);scene.add(complex,spaceportFence(w));
 const terrain=new T.PlaneGeometry(1800,1800,450,450);terrain.rotateX(-Math.PI/2);const v=terrain.attributes.position;for(let i=0;i<v.count;i++){const x=v.getX(i)+s.x,z=v.getZ(i)+s.z;v.setXYZ(i,x,terrainHeight(w,x,z)-.02,z);}terrain.computeVertexNormals();scene.add(new T.Mesh(terrain,new T.MeshStandardMaterial({color:'#747d5b',roughness:1})));
 const port=w.buildings.find(b=>b.id===s.building),model=buildingModel(port);model.position.set(port.x,port.foundationY,port.z);scene.add(model);
 // Actual saved access roads, draped at metre-scale sampling over the terrain.
 for(const road of w.roads??[]) {if(Math.hypot(road.a.x-s.x,road.a.z-s.z)>900)continue;const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,l=Math.hypot(dx,dz),n=Math.ceil(l/4),p=[],indices=[];for(let i=0;i<=n;i++)for(const side of [-1,1]){const x=road.a.x+dx*i/n+side*dz/l*road.width/2,z=road.a.z+dz*i/n-side*dx/l*road.width/2;p.push(x,terrainHeight(w,x,z)+.04,z);}for(let i=0;i<n;i++){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color:'#a49b82',side:T.DoubleSide})));}
 const human=createHuman();human.animate(0,0);const hp=spaceportPoint(s,-11,s.fence+7);human.group.position.set(hp.x,terrainHeight(w,hp.x,hp.z),hp.z);scene.add(human.group);
 scene.updateMatrixWorld(true);
 const rocketSize=new T.Box3().setFromObject(model.getObjectByName('Cargo rocket')).getSize(new T.Vector3());window.rocketSize=rocketSize.toArray();
 const view=(x,y,z,tx,ty,tz)=>{const p=spaceportPoint(s,x,z),t=spaceportPoint(s,tx,tz);camera.position.set(p.x,terrainHeight(w,p.x,p.z)+y,p.z);camera.lookAt(t.x,terrainHeight(w,t.x,t.z)+ty,t.z);};
 window.show=(name)=>{if(name==='overview')view(650,480,960,0,35,240);if(name==='entrance')view(48,13,s.fence+48,4,4,s.fence-10);if(name==='freight')view(215,18,500,166,3,452);if(name==='parking')view(150,62,s.fence+15,56,2,s.fence-55);if(name==='yard')view(-260,120,480,-100,22,220);document.querySelector('#title').innerHTML={overview:'Puddlewick launch complex',entrance:'Security entrance & terminal',yard:'Horizontal integration & heavy transport yard',parking:'Visitor parking & connected concrete forecourt',freight:'Freight yard & ground support equipment'}[name]+'<small>Actual game models · metre-scale layout</small>';renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,layout:s.layout};};
 window.gate=(open)=>{for(let i=0;i<180;i++)complex.userData.animateGate(open?[spaceportPoint(s,0,s.fence+15)]:[],1/30);renderer.render(scene,camera);return complex.children.flatMap(g=>g.children).filter(g=>g.userData.spaceportGate).map(g=>g.rotation.z);};
 const hinges=[];complex.traverse(o=>{if(o.userData.spaceportGate)hinges.push(o);});freezeScenery(complex,hinges);
 window.driveGate=(direction)=>{const p=addPlayer(w,'gate-test','Gate test'),start=spaceportPoint(s,0,s.fence+direction*30);p.x=start.x;p.z=start.z;p.y=terrainHeight(w,p.x,p.z);p.heading=direction===1?Math.PI*1.25:Math.PI/4;p.engineOn=true;let raised=false;
 for(let i=0;i<240;i++){move(w,p,{throttle:1,steer:0,boost:false},1/30);complex.userData.animateGate([p],1/30);if(Math.abs(hinges[0].rotation.z)>1)raised=true;}
 const localZ=((p.x-s.x)+(p.z-s.z))/Math.SQRT2;delete w.players[p.id];return {raised,crossed:direction*(localZ-s.fence)<-10};};
 window.ready=true;
 </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__spaceport_preview');
  await page.waitForFunction(() => !!(window as any).ready);
  const rocketSize = await page.evaluate(() => (window as any).rocketSize as number[]);
  assert.ok(
    rocketSize[1] < 230 && rocketSize[0] < 56 && rocketSize[2] < 64,
    'Full rocket including landing gear fits through the integration hall door horizontally',
  );
  console.log('Rocket dimensions', rocketSize);
  for (const view of ['overview', 'yard', 'parking', 'freight', 'entrance']) {
    console.log(view, await page.evaluate((n) => (window as any).show(n), view));
    await page.screenshot({ path: output + '/' + view + '.png' });
  }
  console.log('gate open', await page.evaluate(() => (window as any).gate(true)));
  await page.screenshot({ path: output + '/entrance-open.png' });
  console.log('gate closed', await page.evaluate(() => (window as any).gate(false)));
  for (const direction of [1, -1])
    assert.deepEqual(await page.evaluate((d) => (window as any).driveGate(d), direction), {
      raised: true,
      crossed: true,
    });
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await server.close();
}
