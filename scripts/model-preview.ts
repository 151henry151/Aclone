// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated close-ups of the exact game models; no production state or paid services.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-models-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/models';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true });
const port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/__livestock_preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#9cac9d}#caption{position:absolute;left:45px;top:35px;color:#f9f4e5;font:20px sans-serif;text-shadow:0 2px 5px #14251b}small{display:block;font-size:13px;margin-top:8px}</style><div id="caption"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {tractor} from '/src/client/tractor.ts'; import {buildingModel} from '/src/client/buildings.ts'; import {makeBuilding} from '/src/shared/simulation.ts'; import {waitForTextures} from '/src/client/materials.ts'; import {TownLighting} from '/src/client/lighting.ts'; import {createWorld} from '/src/shared/simulation.ts';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#9fafae');scene.fog=new T.Fog('#9fafae',12,40);
 scene.add(new T.HemisphereLight('#d9e9ef','#586240',2.2));const sun=new T.DirectionalLight('#fff1cf',3);sun.position.set(4,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.025;scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#66754a',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // Restrained grass blades provide size and contact cues without covering the subject.
 const grass=new T.InstancedMesh(new T.ConeGeometry(.025,.14,3),new T.MeshStandardMaterial({color:'#80905b'}),1800),m=new T.Matrix4();for(let i=0;i<1800;i++){const a=i*2.399,r=1.8+(i%120)/18;m.makeTranslation(Math.sin(a)*r,.05,Math.cos(a)*r);grass.setMatrixAt(i,m);}scene.add(grass);
 const camera=new T.PerspectiveCamera(36,1400/900,.01,100);
 let group=new T.Group();scene.add(group);
 window.showAnimal=async(kind)=>{scene.remove(group);group=new T.Group();scene.add(group);const building=kind!=='tractor';if(building){const b=makeBuilding('show-home','home',0,0);b.style='timber';b.smoking=true;group.add(buildingModel(b));await waitForTextures();if(kind==='night'){const w=createWorld('show','show','owner');w.buildings=[b];w.settings.time=72000;const lighting=new TownLighting();lighting.reset(group);lighting.update(w,new T.Vector3(0,2,5));scene.add(lighting.group);sun.intensity=.1;scene.children.find(o=>o.isHemisphereLight).intensity=.15;scene.background.set('#111a29');scene.fog.color.set('#111a29');}}else{tractor(group,'#a93625');await waitForTextures();}camera.position.set(building?10:5,building?6:3.6,building?14:7);camera.lookAt(0,building?1.9:1.4,0);document.querySelector('#caption').innerHTML=kind.toUpperCase()+'<small>Aclone · simplified geometry and shared detail textures</small>';renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
 window.ready=true;
 </script></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__livestock_preview`);
  await page.waitForFunction(() => !!(window as any).ready);
  for (const kind of ['tractor', 'house', 'night']) {
    console.log(kind, await page.evaluate((k) => (window as any).showAnimal(k), kind));
    await page.screenshot({ path: join(output, kind + '.png') });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
