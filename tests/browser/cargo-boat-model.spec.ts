// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
test('coaster has finite bounded geometry, human-scale helm and a visible changing cargo load', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__cargo-model', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
  <script>globalThis.__ACLONE_BASE__='/'</script><script type="module">
  import * as T from '/node_modules/three/build/three.module.js';
  try {
   const {createCargoBoat}=await import('/src/client/cargo-boat.ts');
   const {vehicleDef}=await import('/src/shared/vehicle-config.ts');
   const {GameScene}=await import('/src/client/scene.ts');
   const {createWorld}=await import('/src/shared/simulation.ts');
   const v=vehicleDef(undefined,35),boat=createCargoBoat(v.color,v);
   const renderer=new T.WebGLRenderer();renderer.setSize(1000,700);document.body.append(renderer.domElement);
   const scene=new T.Scene();scene.background=new T.Color('#8badbc');scene.add(boat.group,new T.HemisphereLight(0xffffff,0x606060,3));
   const camera=new T.PerspectiveCamera(45,1000/700,.1,200);camera.position.set(18,14,23);camera.lookAt(0,1,0);
   boat.setLoad(0);renderer.render(scene,camera);
   const empty=boat.cargo.visible;
   const w=createWorld('moored-model','Moored model','owner');w.mooredBoats={'owner:35':{owner:'owner',slot:35,x:0,z:1000,heading:0,paint:'',landing:'pier',load:.5}};
   const game={mooredGroup:new T.Group(),mooredKey:'',scene:new T.Scene(),ocean:{absorb(){}}};
   GameScene.prototype.updateMooredBoats.call(game,w);const original=game.mooredGroup.children[0];
   w.mooredBoats['owner:35'].x+=1;GameScene.prototype.updateMooredBoats.call(game,w);const reused=game.mooredGroup.children[0]===original;
   w.vehicleTuning={35:{length:22}};GameScene.prototype.updateMooredBoats.call(game,w);
   const tuned=game.mooredGroup.children[0]!==original;
   boat.setLoad(1);renderer.render(scene,camera);boat.group.updateMatrixWorld(true);
   const bounds=new T.Box3().setFromObject(boat.group),size=bounds.getSize(new T.Vector3());
   let triangles=0,finite=true;
   boat.group.traverse(o=>{if(o.isMesh){const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;finite&&=Array.from(g.attributes.position.array).every(Number.isFinite);}});
   const driver=boat.group.userData.driver,person=new T.Box3().setFromObject(driver).getSize(new T.Vector3());
   window.result={reused,tuned,empty,loaded:boat.cargo.visible,finite,triangles,size:size.toArray(),person:person.toArray(),eye:boat.group.userData.eye.toArray(),error:null};
  }catch(e){window.result={error:String(e)}}
  </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__cargo-model');
    await page.waitForFunction(() => !!(window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    expect(r.error).toBeNull();
    expect(r.empty).toBe(false);
    expect(r.loaded).toBe(true);
    expect(r.finite).toBe(true);
    expect(r.reused).toBe(true);
    expect(r.tuned).toBe(true);
    expect(r.triangles).toBeLessThan(40000);
    expect(r.size[2]).toBeGreaterThanOrEqual(20);
    expect(r.size[2]).toBeLessThan(23);
    expect(r.size[0]).toBeGreaterThanOrEqual(5.6);
    expect(r.size[0]).toBeLessThan(7);
    expect(r.person[1]).toBeGreaterThan(1);
    expect(r.person[1]).toBeLessThan(2);
    expect(r.eye.every(Number.isFinite)).toBe(true);
    await page.screenshot({ path: 'output/cargo-boat/model-loaded.png' });
  } finally {
    await page.close();
    await server.close();
  }
});
