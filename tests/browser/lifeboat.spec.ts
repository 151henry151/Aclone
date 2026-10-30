// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

test('rescue raft rows with automatic bounded flare illumination and no headlights', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__raft', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `
      <!doctype html><style>body{margin:0;background:#172c2d}canvas{display:block}</style><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {OtherVehicleLights} from '/src/client/vehicle-lights.ts';
      import {createWorld,addPlayer} from '/src/shared/simulation.ts';
      import {Ocean} from '/src/client/ocean.ts';
      const w=createWorld('test','Rescue','a');w.settings.seaLevel=0;w.settings.oceanWaves=0;
      const p=addPlayer(w,'a','Rower');p.vehicle=29;p.lights=false;
      const scene=new T.Scene(),ocean=new Ocean();scene.add(ocean.create(w));
      const raft=GameScene.prototype.vehicle.call({},29);scene.add(raft);
      const pool=new OtherVehicleLights();scene.add(pool.group);const models=new Map([['a',raft]]);
      const camera=new T.PerspectiveCamera(38,1200/850,.1,200);camera.position.set(4.5,3.2,5.8);camera.lookAt(0,.55,0);
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,850);renderer.toneMapping=T.ACESFilmicToneMapping;
      document.body.append(renderer.domElement);scene.add(new T.HemisphereLight('#d3eaff','#345250',2));
      const sun=new T.DirectionalLight('#fff0da',3);sun.position.set(3,6,5);scene.add(sun);
      const ambient=scene.children.find(c=>c.isHemisphereLight);
      window.show=(night=false,rear=false)=>{
        scene.background=new T.Color(night?'#09151e':'#9abdc6');ambient.intensity=night?.13:2;sun.intensity=night?.025:3;
        camera.position.set(rear?-4.5:4.5,3.2,rear?-5.8:5.8);camera.lookAt(0,.55,0);
        ocean.update(w,0,0,10,1/60,night?.03:1);raft.userData.lifeboat.userData.row(1.7,2.5);
        pool.update(w,models,'a',camera.position,1.7);renderer.render(scene,camera);
        return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      };
      const measurements=[];
      for(const lights of [true,false]){p.lights=lights;pool.update(w,models,'a',camera.position,1.7);
        measurements.push({headlights:pool.lights.filter(l=>l.intensity>0).length,flares:pool.flares.filter(l=>l.intensity>0).length,power:pool.flares[0].intensity});}
      for(let i=0;i<8;i++){const other=addPlayer(w,'rescue'+i,'Rescue');other.vehicle=29;other.lights=true;
        const model=GameScene.prototype.vehicle.call({},29);model.position.set(i,0,-3);models.set(other.id,model);}
      pool.update(w,models,'a',camera.position,2);
      const bounded=pool.flares.length===2&&pool.flares.every(l=>!l.castShadow)&&pool.flares[0].userData.player==='a';
      models.clear();models.set('a',raft);
      window.result={measurements,bounded};window.show();
      </script>`,
      }),
    );
    await page.setViewportSize({ width: 1200, height: 850 });
    await page.goto(server.resolvedUrls!.local[0] + '__raft');
    await page.waitForFunction(() => (window as any).result);
    const result = await page.evaluate(() => (window as any).result);
    for (const m of result.measurements) {
      expect(m.headlights).toBe(0);
      expect(m.flares).toBe(1);
      expect(m.power).toBeGreaterThan(0);
    }
    expect(result.bounded).toBe(true);
    mkdirSync('output/lifeboat-redesign', { recursive: true });
    for (const [name, night, rear] of [
      ['day', false, false],
      ['night', true, false],
      ['rear', false, true],
    ] as const) {
      await page.evaluate(([night, rear]) => (window as any).show(night, rear), [night, rear]);
      await page.screenshot({ path: 'output/lifeboat-redesign/' + name + '.png' });
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
