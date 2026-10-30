// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
import { createWorld } from '../../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../../src/server/puddlewick-spaceport';
test('remote spaceport fence and phase-correct exhaust render without shader errors', async ({
  page,
}) => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server', 'economy');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  expect(ensurePuddlewickSpaceport(w)).toBe(true);
  const vite = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.route('**/__spaceport', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}#label{position:absolute;top:24px;left:30px;color:white;font:20px sans-serif;text-shadow:0 1px 3px black}</style><div id="label"></div><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {spaceportModel} from '/src/client/spaceport.ts';
 import {spaceportFence} from '/src/client/spaceport-fence.ts';
 import {terrainHeight} from '/src/shared/terrain.ts';
 import {spaceportFlight} from '/src/shared/spaceport-flight.ts';
 const w=${JSON.stringify(w)},s=w.spaceportSite,b=w.buildings.find(b=>b.id===s.building);
 const scene=new T.Scene();scene.background=new T.Color('#8daec3');scene.add(new T.HemisphereLight('#edf4ff','#626950',2));
 const sun=new T.DirectionalLight('#fff2da',3);sun.position.set(-200,500,180);scene.add(sun);
 const ground=new T.PlaneGeometry(1800,1800,160,160);ground.rotateX(-Math.PI/2);const a=ground.getAttribute('position');
 for(let i=0;i<a.count;i++){a.setXYZ(i,a.getX(i)+s.x,terrainHeight(w,a.getX(i)+s.x,a.getZ(i)+s.z),a.getZ(i)+s.z);}ground.computeVertexNormals();
 scene.add(new T.Mesh(ground,new T.MeshStandardMaterial({color:'#727b54',roughness:1})));
 const port=spaceportModel();port.position.set(b.x,b.foundationY,b.z);scene.add(port,spaceportFence(w));
 const camera=new T.PerspectiveCamera(45,1400/900,.2,20000),r=new T.WebGLRenderer({antialias:true});r.setSize(1400,900);r.toneMapping=T.ACESFilmicToneMapping;document.body.append(r.domElement);
 const launch=spaceportFlight(w.id,0).next;
 window.show=(name,t=340)=>{port.userData.flight.update(w.id,launch+t);
 if(name==='gate'){const x=s.x+s.fence/Math.sqrt(2),z=s.z+s.fence/Math.sqrt(2);camera.position.set(x+25,terrainHeight(w,x,z)+7,z+25);camera.lookAt(x-13,terrainHeight(w,x,z)+2,z+4);}
 else if(name==='compound'){camera.position.set(s.x+1100,s.height+1000,s.z+1350);camera.lookAt(s.x,s.height,s.z);}
 else{camera.position.set(s.x+220,s.height+170,s.z+360);camera.lookAt(s.x,s.height+110,s.z);}
 document.querySelector('#label').textContent='Puddlewick spaceport — '+name+' (local preview)';r.render(scene,camera);
 return {clouds:port.userData.flight.group.userData.groundPuffs??0,contact:port.userData.flight.group.userData.groundContact??0,calls:r.info.render.calls};};window.ready=true;
 </script>`,
      }),
    );
    await page.goto(vite.resolvedUrls!.local[0] + '__spaceport');
    await page.waitForFunction(() => !!(window as any).ready);
    mkdirSync('output/spaceport-redesign/preview', { recursive: true });
    for (const [name, t] of [
      ['approach', 275],
      ['landing', 295],
      ['touchdown', 302],
      ['launch', 23],
      ['compound', 340],
      ['gate', 340],
    ] as const) {
      const result = await page.evaluate(([name, t]) => (window as any).show(name, t), [
        name,
        t,
      ] as const);
      if (name === 'approach') {
        expect(result.clouds).toBe(0);
        expect(result.contact).toBe(0);
      }
      if (name === 'touchdown') {
        expect(result.clouds).toBeGreaterThan(20);
        expect(result.contact).toBeGreaterThan(0.5);
      }
      await page.screenshot({ path: 'output/spaceport-redesign/preview/' + name + '.png' });
    }
    expect(errors).toEqual([]);
  } finally {
    await vite.close();
  }
});
