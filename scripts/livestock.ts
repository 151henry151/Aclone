// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated close-ups of the exact game models; no production state or paid services.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-animals-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/livestock';
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
 import * as T from '/node_modules/three/build/three.module.js';
 import {animalModel,animalMaterial} from '/src/client/animal-model.ts';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#9fafae');scene.fog=new T.Fog('#9fafae',12,40);
 scene.add(new T.HemisphereLight('#d9e9ef','#586240',2.2));const sun=new T.DirectionalLight('#fff1cf',3);sun.position.set(4,7,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-5;sun.shadow.camera.right=5;sun.shadow.camera.top=5;sun.shadow.camera.bottom=-5;sun.shadow.normalBias=.025;scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#66754a',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 // Restrained grass blades provide size and contact cues without covering the subject.
 const grass=new T.InstancedMesh(new T.ConeGeometry(.025,.14,3),new T.MeshStandardMaterial({color:'#80905b'}),1800),m=new T.Matrix4();for(let i=0;i<1800;i++){const a=i*2.399,r=1.8+(i%120)/18;m.makeTranslation(Math.sin(a)*r,.05,Math.cos(a)*r);grass.setMatrixAt(i,m);}scene.add(grass);
 const camera=new T.PerspectiveCamera(36,1400/900,.01,100);
 let group=new T.Group();scene.add(group);
 window.showAnimal=(kind)=>{for(const o of group.children){o.geometry.dispose();o.material.dispose();}group.clear();const material=animalMaterial();for(const part of animalModel(kind)){const mesh=new T.Mesh(part.geometry,material);mesh.position.copy(part.pivot);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}const bird=kind==='chickens';const scale=bird?.43:kind==='cows'?1:.72;camera.position.set(4.2*scale,2.4*scale,5.5*scale);camera.lookAt(0,bird?.35:kind==='cows'?.86:.52,0);document.querySelector('#caption').innerHTML=kind.toUpperCase()+'<small>Aclone · actual 3D model · close-up preview lighting</small>';renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
 window.ready=true;
 </script></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__livestock_preview`);
  await page.waitForFunction(() => !!(window as any).ready);
  for (const kind of ['cows', 'sheep', 'pigs', 'chickens']) {
    console.log(kind, await page.evaluate((k) => (window as any).showAnimal(k), kind));
    await page.screenshot({ path: join(output, kind + '.png') });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
