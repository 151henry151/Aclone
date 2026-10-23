// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('biplane factory renders a paintable airframe, grounded stance and working cockpit', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await server.listen();
  try {
    await page.route('**/__plane-test', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {tractorPaint} from '/src/shared/appearance.ts';
      import {updateBiplaneInstruments} from '/src/client/biplane.ts';
      const model=GameScene.prototype.vehicle.call({},2,undefined,'plum');
      const plane=model.userData.biplane, airframe=plane.group.getObjectByName('Biplane airframe');
      const prop=model.getObjectByName('Biplane propeller'), panel=plane.group.userData.flightPanel.panel;
      const eye=model.userData.eye.clone(), start=prop.rotation.z;
      plane.animate(.1,false,0);const stopped=prop.rotation.z===start;
      plane.animate(.1,true,5);const spinning=prop.rotation.z!==start;
      const level=airframe.rotation.x===0, eyeMoves=model.userData.eye.distanceTo(eye)>.1;
      plane.animate(.1,false,0);const grounded=airframe.rotation.x<0;
      const staticMap=panel.material.map, pilot={vehicle:2,fuel:30,speed:20};
      updateBiplaneInstruments(plane.group,pilot,50,1);const map=panel.material.map, initial=map.version;
      updateBiplaneInstruments(plane.group,{...pilot,speed:35},70,1.05);const throttled=map.version===initial;
      updateBiplaneInstruments(plane.group,{...pilot,speed:35},70,1.3);const changed=map.version>initial;
      const updated=map.version;updateBiplaneInstruments(plane.group,{...pilot,speed:35},70,1.6);const unchanged=map.version===updated;
      let triangles=0,meshes=0,finite=true,painted=false;
      model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
        for(const a of Object.values(o.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);
        painted||=o.material.color?.getHexString()===tractorPaint('plum').color.slice(1);
      }});
      const bounds=new T.Box3().setFromObject(model,true), size=bounds.getSize(new T.Vector3());
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(800,600);document.body.append(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#b4beb4');scene.add(new T.HemisphereLight('#ffffff','#68764e',3),model);
      const camera=new T.PerspectiveCamera(40,800/600,.05,100);camera.position.set(10,6,12);camera.lookAt(0,1.5,0);renderer.render(scene,camera);
      window.result={stopped,spinning,level,eyeMoves,grounded,throttled,changed,unchanged,privateMap:map!==staticMap,sharedBase:staticMap.userData.shared,finite,painted,triangles,meshes,size:size.toArray(),low:bounds.min.y};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__plane-test');
    await page.waitForFunction(() => (window as any).result);
    const result = await page.evaluate(() => (window as any).result);
    for (const key of [
      'stopped',
      'spinning',
      'level',
      'eyeMoves',
      'grounded',
      'throttled',
      'changed',
      'unchanged',
      'privateMap',
      'sharedBase',
      'finite',
      'painted',
    ])
      expect(result[key], key).toBe(true);
    expect(result.triangles).toBeLessThan(14000);
    expect(result.meshes).toBeLessThanOrEqual(21);
    expect(result.size[0]).toBeGreaterThan(8.8);
    expect(result.size[0]).toBeLessThan(9.3);
    expect(Math.abs(result.low)).toBeLessThan(0.04);
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/biplane-model.png' });
  } finally {
    await server.close();
  }
});
