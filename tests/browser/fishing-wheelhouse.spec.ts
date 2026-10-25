// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('fishing wheelhouse has a clear helm view and independent live navigation instruments', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__wheelhouse', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {nauticalHeading} from '/src/client/fishing-wheelhouse.ts';
      const boat=GameScene.prototype.vehicle.call({},30), other=GameScene.prototype.vehicle.call({},30);
      const cockpit=boat.userData.fishingBoat.cockpit;
      const panel=boat.getObjectByName('Live marine instruments'), compass=boat.getObjectByName('Working nautical compass');
      const independent=panel.material.map!==other.getObjectByName('Live marine instruments').material.map && compass.material.map!==other.getObjectByName('Working nautical compass').material.map;
      const p={heading:Math.PI/2,speed:4,fuel:2400,boatThrottle:.65,engine:true};
      cockpit.update(p,1);const updated=panel.material.map.version;cockpit.update(p,2);const idle=panel.material.map.version===updated;
      const before=other.getObjectByName('Working nautical compass').material.map.version;
      cockpit.update({...p,heading:Math.PI,fuel:1600,boatThrottle:-.3},3);
      const changed=panel.material.map.version>updated && other.getObjectByName('Working nautical compass').material.map.version===before;
      const throttle=boat.getObjectByName('Engine telegraph lever').rotation.x;
      boat.userData.driver.visible=false;boat.updateMatrixWorld(true);
      const ray=new T.Raycaster(boat.userData.eye,new T.Vector3(0,0,1));
      const blocked=ray.intersectObject(boat,true).filter(h=>!h.object.isSkinnedMesh&&h.distance>.1).map(h=>h.object.name);
      let triangles=0,meshes=0;boat.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#adc6cb');scene.add(boat);
      const ambient=new T.HemisphereLight('#eef1e6','#728b83',2.4);scene.add(ambient);
      const sun=new T.DirectionalLight('#ffebce',2.5);sun.position.set(-8,15,10);scene.add(sun);
      const water=new T.Mesh(new T.PlaneGeometry(3000,3000),new T.MeshStandardMaterial({color:'#397d88',roughness:.42,metalness:.15}));water.rotation.x=-Math.PI/2;scene.add(water);
      const camera=new T.PerspectiveCamera(60,1440/900,.05,2000);camera.position.copy(boat.userData.eye);
      let time=4;
      window.renderWheelhouse=(view)=>{
        const night=view==='night';ambient.intensity=night?.16:2.4;sun.intensity=night?.03:2.5;scene.background.set(night?'#142831':'#adc6cb');
        const direction={helm:[0,-.12,1],port:[1,-.3,.65],starboard:[-1,-.3,.65],aft:[.5,-.1,-1],night:[0,-.12,1]}[view];
        camera.lookAt(camera.position.clone().add(new T.Vector3(...direction)));
        cockpit.update({...p,heading:0},time++);renderer.render(scene,camera);
        return {draws:renderer.info.render.calls,readings:cockpit.group.userData.readings};
      };
      window.result={independent,idle,changed,throttle,blocked,triangles,meshes,cardinals:[Math.PI,Math.PI/2,0,-Math.PI/2,Math.PI*3].map(nauticalHeading)};
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__wheelhouse');
    await page.waitForFunction(() => (window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    expect(r.independent).toBe(true);
    expect(r.idle).toBe(true);
    expect(r.changed).toBe(true);
    expect(r.throttle).toBeLessThan(0);
    expect(r.blocked).toEqual([]);
    expect(r.cardinals).toEqual([0, 90, 180, 270, 0]);
    expect(r.triangles).toBeLessThan(18000);
    expect(r.meshes).toBeLessThan(40);
    for (const view of ['helm', 'port', 'starboard', 'aft', 'night']) {
      const frame = await page.evaluate((view) => (window as any).renderWheelhouse(view), view);
      expect(frame.readings.heading).toBe(180);
      expect(frame.readings.fuel).toBe(2400);
      expect(frame.readings.speedKnots).toBeCloseTo(7.775, 2);
      expect(frame.draws).toBeLessThan(38);
      await page.screenshot({ path: 'test-results/fishing-wheelhouse-' + view + '.png' });
    }
    console.log(JSON.stringify(r));
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
