// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
test('charter model has an outward hull, clear helm, live instruments and bounded rendering cost', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__charter-model', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<script type="module">
    globalThis.__ACLONE_BASE__='/';
    import * as T from '/node_modules/three/build/three.module.js';
    import {GameScene} from '/src/client/scene.ts';
    import {createHuman} from '/src/client/human.ts';
    import {charterPassengerPosition} from '/src/shared/charter.ts';
    const model=GameScene.prototype.vehicle.call({},31,undefined,'plum');const boat=model.userData.charterBoat;
    model.updateMatrixWorld(true);model.userData.driver.visible=false;
    const ray=new T.Raycaster(model.userData.eye,new T.Vector3(0,0,1));
    const hits=ray.intersectObject(model,true).filter(h=>!h.object.isSkinnedMesh && !h.object.material.transparent);
    const sideRay=new T.Raycaster(new T.Vector3(10,.5,0),new T.Vector3(-1,0,0));
    const side=sideRay.intersectObject(model,true).filter(h=>!h.object.material.transparent);
    let meshes=0,triangles=0,finite=true,painted=false;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const a of Object.values(o.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);painted||=o.material.color?.getHexString()==='76516d';}});
    boat.cockpit.update({heading:-Math.PI/2,speed:4,fuel:96,engine:true,boatThrottle:.5},1);
    const bounds=new T.Box3().setFromObject(model),human=new T.Box3().setFromObject(createHuman('seated').group),driver=new T.Box3().setFromObject(model.userData.driver);
    window.result={meshes,triangles,finite,clear:hits.length===0,hits:hits.map(h=>h.distance),hullOutside:side[0]?.point.x>2.1,length:bounds.max.z-bounds.min.z,width:bounds.max.x-bounds.min.x,driverHeight:driver.max.y-driver.min.y,humanHeight:human.max.y-human.min.y,readings:boat.cockpit.group.userData.readings,seats:Array.from({length:6},(_,i)=>charterPassengerPosition(i))};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__charter-model');
    await page.waitForFunction(() => (window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    console.log(r);
    expect(r.finite).toBe(true);
    expect(r.clear).toBe(true);
    expect(r.hullOutside).toBe(true);
    expect(r.meshes).toBeLessThan(50);
    expect(r.triangles).toBeLessThan(18000);
    expect(r.length).toBeGreaterThan(13);
    expect(r.length).toBeLessThan(16);
    expect(r.width).toBeLessThan(6);
    expect(r.driverHeight).toBeCloseTo(r.humanHeight, 3);
    expect(r.readings.heading).toBe(270);
    expect(r.readings.fuel).toBe(96);
    expect(r.readings.throttle).toBe(0.5);
    expect(new Set(r.seats.map(JSON.stringify)).size).toBe(6);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});
