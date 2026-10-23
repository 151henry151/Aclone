// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('all six tractor models print their actual wheel widths and spacing in snow and mud', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await server.listen();
  try {
    await page.route('**/__tyres', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
      <style>body{margin:0;background:#dce1e4;font:16px sans-serif;color:#213338}header{display:flex;text-align:center;padding:20px 0}header div{flex:1}small{display:block;margin-top:8px}</style>
      <header><div>Puddle<small>48 cm tyres</small></div><div>Orchard Wren<small>38 cm tyres</small></div><div>Swift Kestrel<small>43 cm tyres</small></div><div>Barley Dray<small>56 cm tyres</small></div><div>Fenlander<small>68 cm tyres</small></div><div>Lamplighter<small>48 cm tyres</small></div></header>
      <script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {GroundTracks,wheelPrints} from '/src/client/ground-tracks.ts';
      import {waitForTextures} from '/src/client/materials.ts';
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,760);document.body.append(renderer.domElement);
      renderer.toneMapping=T.ACESFilmicToneMapping;
      const scene=new T.Scene();scene.background=new T.Color('#dce1e4');scene.add(new T.HemisphereLight('#ffffff','#657775',2));
      const sun=new T.DirectionalLight('#fff5db',3);sun.position.set(-8,15,10);scene.add(sun);
      const camera=new T.OrthographicCamera(-18,18,9.5,-9.5,.1,100);camera.position.set(0,24,14);camera.lookAt(0,0,0);
      const surface=new T.MeshStandardMaterial({color:'#e7edf1',roughness:1});
      const geometry=new T.PlaneGeometry(80,80);geometry.rotateX(-Math.PI/2);scene.add(new T.Mesh(geometry,surface));
      const tracks=new GroundTracks();scene.add(tracks.mesh);
      const models=[0,24,25,26,27,28].map((slot,i)=>{
        const model=GameScene.prototype.vehicle.call({},slot);model.position.set(-15+i*6,0,4);scene.add(model);return model;
      });
      window.renderTracks=async(kind)=>{
        tracks.marks=[];
        surface.color.set(kind==='snow'?'#e7edf1':'#a58e6d');
        for(const [i,model] of models.entries()){
          // Gentle bend shows independent front/rear wheel paths, ending straight.
          for(let z=-8;z<=4;z+=.25){
            const bend=z<0?Math.sin((z+8)*Math.PI/8)**2*.6:0;
            model.position.set(-15+i*6+bend,0,z);
            model.rotation.y=z<0?Math.atan(Math.sin((z+8)*Math.PI/4)*.6*Math.PI/8):0;
            model.updateMatrixWorld();
            for(const [j,p] of wheelPrints(model.userData.tyreFootprints,model.matrixWorld).entries())
              tracks.record(kind+':'+i+':'+j,p.x,p.z,p.heading,kind,true,.11,p.width);
          }
        }
        tracks.sync(()=>.002,kind==='snow'?.11:0);
        await waitForTextures();renderer.render(scene,camera);
        return {marks:tracks.marks.length,models:models.map(model=>({
          widths:model.userData.tyreFootprints.map(p=>p.width),
          contacts:model.userData.tyreFootprints.map(p=>p.position.toArray()),
          wheels:model.userData.wheels.map(w=>[w.position.x,w.position.y-w.userData.radius,w.position.z])
        }))};
      };
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__tyres');
    await page.waitForFunction(() => typeof (window as any).renderTracks === 'function');
    for (const kind of ['snow', 'mud']) {
      const result = await page.evaluate((k) => (window as any).renderTracks(k), kind);
      expect(result.marks).toBeGreaterThan(200);
      for (const [i, model] of result.models.entries()) {
        expect(model.widths).toEqual(Array(4).fill([0.48, 0.38, 0.43, 0.56, 0.68, 0.48][i]));
        expect(model.contacts).toEqual(model.wheels);
      }
      await page.screenshot({ path: `output/tyre-tracks/${kind}.png` });
    }
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});
