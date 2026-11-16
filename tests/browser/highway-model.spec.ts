// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('inspect highway tractor, coupled trailer and live instruments from all working viewpoints', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-highway-model-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const output = `output/highway-rework/${process.env.MODEL_EVIDENCE ?? 'after'}`;
  mkdirSync(output, { recursive: true });
  try {
    const port = await app.listen();
    await page.route('**/__highway_model', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#c1cbc9}#caption{position:absolute;top:20px;left:30px;font:22px sans-serif;color:#152a2d}</style><div id="caption"></div><script type="module">
    import * as T from '/node_modules/three/build/three.module.js';
    import { createHighwayTractor, createSemitrailer } from '/src/client/highway-model.ts';
    import { createWorld, addPlayer } from '/src/shared/simulation.ts';
    import { waitForTextures } from '/src/client/materials.ts';
    const w=createWorld('render','Truck render','p'), p=addPlayer(w,'p','Driver');
    p.vehicle=37;p.fuel=160;p.speed=17.8816;p.fleetState={37:{condition:75}};
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;
    document.body.append(renderer.domElement);
    const scene=new T.Scene();scene.background=new T.Color('#c1cbc9');const skyLight=new T.HemisphereLight('#f0f5f7','#777c73',2.4);scene.add(skyLight);
    const sun=new T.DirectionalLight('#fff4df',3);sun.position.set(7,10,4);scene.add(sun);
    const truck=createHighwayTractor(w);scene.add(truck);
    let trailer=createSemitrailer('semiBox',{},w);trailer.position.z=-7.1;trailer.userData.landingLegs.position.y=trailer.userData.landingLegs.userData.retractedY;scene.add(trailer);
    const camera=new T.PerspectiveCamera(40,1440/900,.02,200);
    const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#828b83',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
    await waitForTextures();
    window.changeTrailer=(kind,cargo)=>{scene.remove(trailer);trailer=createSemitrailer(kind,cargo,w);trailer.position.z=-7.1;trailer.userData.landingLegs.position.y=trailer.userData.landingLegs.userData.retractedY;scene.add(trailer);};
    window.show=(view,speed=17.8816,fuel=160,condition=75)=>{
      const night=view==='seat-night';if(night)view='seat';skyLight.intensity=night?.04:2.4;sun.intensity=night?.02:3;scene.background.set(night?'#101723':'#c1cbc9');
      trailer.visible=view.startsWith('rig'); ground.visible=view!=='under';truck.userData.driver.visible=view!=='seat';
      p.speed=speed;p.fuel=fuel;p.fleetState[37].condition=condition;truck.userData.highwayAnimate(p,0);
      const views={side:[[12,3,0],[0,1.7,0]],front:[[6,4,11],[0,1.7,0]],rear:[[-6,3,-10],[0,1.5,0]],under:[[5,-4,-5],[0,.7,0]],rig:[[17,8,13],[0,1.8,-4]],'rig-rear':[[-15,6,-22],[0,1.8,-6]],seat:[truck.userData.eye.toArray(),[truck.userData.eye.x,truck.userData.eye.y-.1,truck.userData.eye.z+4]]};
      camera.position.fromArray(views[view][0]);camera.lookAt(...views[view][1]);camera.fov=view==='seat'?53:40;camera.updateProjectionMatrix();renderer.render(scene,camera);
      document.querySelector('#caption').textContent=view==='seat'?'Driver view · 40 mph / half tank / 75% condition':'Highway tractor · '+view;
      return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    };window.ready=true;
    </script></html>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__highway_model`);
    await page.waitForFunction(() => Boolean((window as any).ready));
    for (const view of [
      'side',
      'front',
      'rear',
      'under',
      'rig',
      'rig-rear',
      'seat',
      'seat-night',
    ]) {
      const budget = await page.evaluate((view) => (window as any).show(view), view);
      expect(budget.draws).toBeLessThan(100);
      expect(budget.triangles).toBeLessThan(20000);
      await page.screenshot({ path: output + '/' + view + '.png' });
    }
    for (const kind of ['semiRefrigerated', 'semiStake']) {
      await page.evaluate((kind) => {
        (window as any).changeTrailer(kind, kind === 'semiStake' ? { logs: 500 } : {});
        (window as any).show('rig-rear');
      }, kind);
      await page.screenshot({ path: output + '/' + kind + '.png' });
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
