// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated close-ups of the exact game models; no production state or paid services.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-buildings-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/buildings';
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.route('**/__building_preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#9cac9d}#caption{position:absolute;left:45px;top:35px;color:#f9f4e5;font:20px sans-serif;text-shadow:0 2px 5px #14251b}small{display:block;font-size:13px;margin-top:8px}</style><div id="caption"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {buildingModel} from '/src/client/buildings.ts'; import {makeBuilding} from '/src/shared/simulation.ts'; import {waitForTextures} from '/src/client/materials.ts';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1050);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#adb9b6');
 scene.add(new T.HemisphereLight('#dce9ef','#726b4c',1.8));const sun=new T.DirectionalLight('#fff1d9',2.7);sun.position.set(-8,15,12);scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:'#77785e',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;scene.add(ground);
 const camera=new T.PerspectiveCamera(36,1600/1050,.1,500);
 let group=new T.Group();scene.add(group);
 window.showBuilding=async(kind)=>{scene.remove(group);group=buildingModel(makeBuilding('preview-'+kind,kind,0,0));scene.add(group);await waitForTextures();const size=new T.Box3().setFromObject(group).getSize(new T.Vector3());const distance=Math.max(size.x,size.y,size.z)*1.9;camera.position.set(distance*.62,distance*.47,distance);camera.lookAt(0,size.y*.4,0);document.querySelector('#caption').innerHTML=kind.toUpperCase()+'<small>Aclone · actual game model · shared baked surface details</small>';renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles-2};};
 window.ready=true;
 </script></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__building_preview`);
  await page.waitForFunction(() => !!(window as any).ready);
  for (const kind of ['bakery', 'bank', 'school', 'garage', 'farm', 'waterworks', 'mill', 'home']) {
    console.log(kind, await page.evaluate((k) => (window as any).showBuilding(k), kind));
    await page.screenshot({ path: join(output, kind + '.png') });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
