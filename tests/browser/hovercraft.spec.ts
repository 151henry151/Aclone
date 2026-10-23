// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('hovercraft has an outward-facing skirt, seated cockpit, independent paint and engine-driven fan', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__hover-test', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {tractorPaint} from '/src/shared/appearance.ts';
      import {updateHovercraftInstruments} from '/src/client/hovercraft.ts';
      const model=GameScene.prototype.vehicle.call({},4,undefined,'plum'), hover=model.userData.hovercraft;
      // The shared movement simulation holds hovercraft origins half a metre above the surface.
      model.position.y=.5;
      const fan=model.getObjectByName('Hovercraft fan'), skirt=model.getObjectByName('Inflatable skirt');
      const before=fan.rotation.z;hover.animate(.1,false);const stopped=fan.rotation.z===before;
      hover.animate(.1,true);const spinning=fan.rotation.z!==before;
      let outward=true;const pos=skirt.geometry.attributes.position,norm=skirt.geometry.attributes.normal;
      for(let i=0;i<pos.count;i++)outward&&=pos.getX(i)*norm.getX(i)+pos.getZ(i)*norm.getZ(i)>0;
      const panel=hover.group.userData.hoverPanel.panel,base=panel.material.map,pilot={vehicle:4,speed:10,fuel:32};
      updateHovercraftInstruments(hover.group,pilot,1);const map=panel.material.map,version=map.version;
      updateHovercraftInstruments(hover.group,{...pilot,speed:20},1.1);const throttled=map.version===version;
      updateHovercraftInstruments(hover.group,{...pilot,speed:20},1.3);const updated=map.version>version;
      const changed=map.version;updateHovercraftInstruments(hover.group,{...pilot,speed:20},1.6);const stable=map.version===changed;
      let meshes=0,triangles=0,painted=false,finite=true;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;painted||=o.material.color?.getHexString()===tractorPaint('plum').color.slice(1);for(const a of Object.values(o.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);}});
      const bounds=new T.Box3().setFromObject(model,true);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(900,650);document.body.append(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#b4beb4');scene.add(new T.HemisphereLight('#ffffff','#68764e',3),model);
      const camera=new T.PerspectiveCamera(40,900/650,.05,100);camera.position.set(8,5,10);camera.lookAt(0,1.5,0);renderer.render(scene,camera);
      window.result={stopped,spinning,outward,throttled,updated,stable,privateMap:map!==base,sharedBase:base.userData.shared,painted,finite,meshes,triangles,low:bounds.min.y,driver:!!model.userData.driver,eye:model.userData.eye.toArray()};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__hover-test');
    await page.waitForFunction(() => (window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    for (const k of [
      'stopped',
      'spinning',
      'outward',
      'throttled',
      'updated',
      'stable',
      'privateMap',
      'sharedBase',
      'painted',
      'finite',
      'driver',
    ])
      expect(r[k], k).toBe(true);
    expect(r.low).toBeGreaterThanOrEqual(0);
    expect(r.low).toBeLessThan(0.12);
    expect(r.triangles).toBeLessThan(15000);
    expect(r.meshes).toBeLessThanOrEqual(24);
    expect(r.eye[1]).toBeGreaterThan(1.7);
    expect(r.eye[1]).toBeLessThan(2.3);
    expect(errors).toEqual([]);
    await page.screenshot({ path: 'test-results/hovercraft-model.png' });
  } finally {
    await server.close();
  }
});
