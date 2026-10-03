// SPDX-License-Identifier: GPL-3.0-or-later
// Isolated close-ups of the exact game models; no production state or paid services.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-rocket-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'test-results/rocket';
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
  await page.route('**/__rocket_preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#9cac9d}#caption{position:absolute;left:45px;top:35px;color:#f9f4e5;font:20px sans-serif;text-shadow:0 2px 5px #14251b}small{display:block;font-size:13px;margin-top:8px}</style><div id="caption"></div><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {spaceportModel} from '/src/client/spaceport.ts';
 import {spaceportFlight} from '/src/shared/spaceport-flight.ts';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#7e9dba');scene.fog=new T.Fog('#7e9dba',1000,2500);scene.add(new T.HemisphereLight('#d9e9ef','#756752',2));const sun=new T.DirectionalLight('#fff1cf',3);sun.position.set(-200,350,180);scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.MeshStandardMaterial({color:'#657149',roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
 const port=spaceportModel();scene.add(port);const flight=port.userData.flight;
 const camera=new T.PerspectiveCamera(45,1400/900,.1,4000);camera.position.set(320,170,390);camera.lookAt(104,115,30);
 const launch=spaceportFlight('rocket-demo',0).next;
 window.showAnimal=(name)=>{const elapsed={ignition:5,launch:27,away:110,landing:285,docked:340}[name];flight.update('rocket-demo',launch+elapsed);document.querySelector('#caption').innerHTML=name.toUpperCase()+'<small>Aclone · actual cargo ship and flight effects</small>';renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
 window.ready=true;
 </script></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__rocket_preview`);
  await page.waitForFunction(() => !!(window as any).ready);
  for (const kind of ['ignition', 'launch', 'away', 'landing', 'docked']) {
    console.log(kind, await page.evaluate((k) => (window as any).showAnimal(k), kind));
    await page.screenshot({ path: join(output, kind + '.png') });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
