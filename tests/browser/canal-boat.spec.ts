// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('canal boat has a waterline hull, independent paint, clear helm view and bounded model cost', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  await page.setViewportSize({ width: 1200, height: 800 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__canal-test', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0;background:#adc6cb}canvas{display:block}</style><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {createHuman} from '/src/client/human.ts';
      import {tractorPaint} from '/src/shared/appearance.ts';
      const model=GameScene.prototype.vehicle.call({},3,undefined,'plum');
      const boat=model.userData.canalBoat;
      const hull=model.getObjectByName('Waterline hull'), tiller=model.getObjectByName('Stern tiller');
      boat.animate(.2);const turning=tiller.rotation.y<0;boat.animate(0);const centred=tiller.rotation.y===0;
      const bounds=new T.Box3().setFromObject(hull,true);
      let meshes=0,triangles=0,painted=false,finite=true,outward=true;
      model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;painted||=o.material.color?.getHexString()===tractorPaint('plum').color.slice(1);for(const a of Object.values(o.geometry.attributes))finite&&=Array.from(a.array).every(Number.isFinite);}});
      const p=hull.geometry.attributes.position,n=hull.geometry.attributes.normal;
      for(let i=0;i<4*33;i++)outward&&=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i)>0;
      const scene=new T.Scene();scene.background=new T.Color('#adc6cb');scene.add(new T.HemisphereLight('#fff9e8','#405b6a',2.6),model);
      const sun=new T.DirectionalLight('#fff2d5',2.5);sun.position.set(-8,15,7);scene.add(sun);
      const water=new T.Mesh(new T.PlaneGeometry(400,400),new T.MeshStandardMaterial({color:'#4c838a',roughness:.35,metalness:.15}));water.rotation.x=-Math.PI/2;scene.add(water);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,800);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      const camera=new T.PerspectiveCamera(40,1.5,.05,600);
      const render=(kind)=>{model.userData.driver.visible=kind!=='helm';if(kind==='helm'){camera.fov=65;camera.position.copy(model.userData.eye);camera.lookAt(camera.position.clone().add(new T.Vector3(0,-.06,1)));}else{camera.fov=40;camera.position.set(kind==='stern'?-7:8,4.8,kind==='stern'?-10:10);camera.lookAt(0,.8,0);}camera.updateProjectionMatrix();renderer.render(scene,camera);};
      window.renderBoat=render;render('bow');
      const ray=new T.Raycaster(model.userData.eye,new T.Vector3(0,0,1));model.userData.driver.visible=false;model.updateMatrixWorld(true);
      const selfHits=ray.intersectObject(boat.group,true).filter(h=>!h.object.isSkinnedMesh && !h.object.material?.transparent);
      model.userData.driver.visible=true;
      const fishing=GameScene.prototype.vehicle.call({},30), fishingBody=fishing.getObjectByName('Fishing hull and fittings');
      fishing.updateMatrixWorld(true);
      const fb=new T.Box3().setFromObject(fishingBody), fd=new T.Box3().setFromObject(fishing.userData.driver);
      const human=new T.Box3().setFromObject(createHuman('seated').group);
      const fishRay=new T.Raycaster(fishing.userData.eye,new T.Vector3(0,0,1));
      const fishingView=fishRay.intersectObject(fishing,true).filter(h=>!h.object.isSkinnedMesh && h.distance>.1);
      window.fishingResult={length:fb.max.z-fb.min.z,width:fb.max.x-fb.min.x,humanHeight:human.max.y-human.min.y,driverHeight:fd.max.y-fd.min.y,clearView:fishingView.length===0};
      window.result={turning,centred,painted,finite,outward,meshes,triangles,low:bounds.min.y,length:bounds.max.z-bounds.min.z,eye:model.userData.eye.toArray(),clearView:selfHits.length===0,driver:!!model.userData.driver};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__canal-test');
    await page.waitForFunction(() => (window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    console.log(JSON.stringify(r));
    const f = await page.evaluate(() => (window as any).fishingResult);
    console.log(JSON.stringify(f));
    expect(f.length).toBeCloseTo(20.445, 1);
    expect(f.width).toBeGreaterThan(7);
    expect(f.driverHeight).toBeCloseTo(f.humanHeight, 3);
    expect(f.clearView).toBe(true);
    for (const k of ['turning', 'centred', 'painted', 'finite', 'outward', 'clearView', 'driver'])
      expect(r[k], k).toBe(true);
    expect(r.low).toBeLessThan(-0.6);
    expect(r.low).toBeGreaterThan(-0.8);
    expect(r.length).toBeGreaterThan(13);
    expect(r.length).toBeLessThan(14);
    expect(r.meshes).toBeLessThanOrEqual(26);
    expect(r.triangles).toBeLessThan(16000);
    expect(errors).toEqual([]);
    for (const kind of ['bow', 'stern', 'helm']) {
      await page.evaluate((k) => (window as any).renderBoat(k), kind);
      await page.screenshot({ path: 'test-results/canal-boat-' + kind + '.png' });
    }
  } finally {
    await server.close();
  }
});
