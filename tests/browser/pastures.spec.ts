// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('pasture fences and all four roaming species render with bounded geometry', async ({
  browser,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-pasture-view-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const port = await app.listen();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__pastures', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}#label{position:absolute;top:24px;left:28px;color:#fff8dc;font:24px Georgia;text-shadow:0 2px 4px #000}</style><div id="label">Aclone · fenced grazing pastures</div><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {createWorld,makeBuilding,addPlayer} from '/src/shared/simulation.ts';
 import {defaultCreator} from '/src/shared/creator.ts';
 import {ensurePastures} from '/src/shared/pastures.ts';
 import {pasturePoint,inPasture} from '/src/shared/pasture-land.ts';
 import {terrainHeight} from '/src/shared/terrain.ts';
 import {LivestockScene,livestockSites} from '/src/client/livestock-scene.ts';
 import {grazingPose} from '/src/client/pasture-motion.ts';
 import {buildingModel} from '/src/client/buildings.ts';
 const w=createWorld('preview','Pastures','owner');w.creator=defaultCreator();w.creator.roads=false;
 w.buildings=['dairy','sheepfold','piggery','henhouse'].map((kind,i)=>{const b=makeBuilding(kind,kind,(i%2)*70-35,Math.floor(i/2)*70-35);b.stock={cows:4,sheep:6,pigs:6,chickens:8};return b;});
 const p=addPlayer(w,'owner','Keeper');ensurePastures(w);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,1000);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#b4cbd2');scene.add(new T.HemisphereLight('#f3f6ff','#505b36',2.5));
 const sun=new T.DirectionalLight('#fff0cf',3);sun.position.set(20,50,20);scene.add(sun);
 const geo=new T.PlaneGeometry(220,220,110,110);geo.rotateX(-Math.PI/2);const pos=geo.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(w,pos.getX(i),pos.getZ(i))-.015);geo.computeVertexNormals();
 scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({color:'#73834c',roughness:1})));
 for(const b of w.buildings){const model=buildingModel(b);model.position.set(b.x,terrainHeight(w,b.x,b.z),b.z);model.rotation.y=b.rotation;scene.add(model);}
 const herds=new LivestockScene();herds.update(w,p);scene.add(herds.group);
 const camera=new T.PerspectiveCamera(40,1440/1000,.1,600);
 window.show=(kind,time)=>{const b=w.buildings.find(b=>b.kind===kind);const q=pasturePoint(b,b.pasture.x,b.pasture.z);camera.position.set(q.x+16,16,q.z+24);camera.lookAt(q.x,1,q.z);herds.animate(time);renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,animals:livestockSites(w,p).length,pastures:w.buildings.filter(b=>b.pasture).length};};
 window.motion=()=>{const s=livestockSites(w,p)[0];return [grazingPose(s,0),grazingPose(s,18)];};
 window.ready=true;</script>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__pastures`);
    await page.waitForFunction(() => !!(window as any).ready);
    for (const kind of ['dairy', 'sheepfold', 'piggery', 'henhouse']) {
      const info = await page.evaluate((k) => (window as any).show(k, 18), kind);
      expect(info.pastures).toBe(4);
      expect(info.animals).toBe(24);
      expect(info.calls).toBeLessThan(500);
      await page.screenshot({ path: `test-results/pasture-${kind}.png` });
    }
    const [a, b] = await page.evaluate(() => (window as any).motion());
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.1);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
