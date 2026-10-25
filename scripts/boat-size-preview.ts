// SPDX-License-Identifier: GPL-3.0-or-later
// A single orthographic camera preserves the relative sizes of both real game models.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/boating';
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__boat_sizes', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#abc4ca;color:#183c39;font-family:Arial}canvas{display:block}header{position:absolute;top:28px;left:35px}h1{font:38px Georgia;margin:0 0 6px}.label{position:absolute;top:120px;font:24px Georgia;width:50%;text-align:center}.right{left:50%}small{display:block;font:17px Arial;margin-top:7px}footer{position:absolute;bottom:24px;left:35px;font-size:19px}</style><header><h1>Canal boat & fishing boat — true size comparison</h1>One orthographic camera · actual game models · normal-size people</header><div class="label">Parish Carrier<small>13.5 m long · 3.4 m wide · 18s</small></div><div class="label right">North Star<small>20.4 m long · 7.3 m wide · 70s</small></div><footer>The trawler is about 1.5× as long and 2.1× as wide as the canal boat. Crew stay at normal human scale.</footer><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {GameScene} from '/src/client/scene.ts';
 import {createHuman} from '/src/client/human.ts';
 const scene=new T.Scene();scene.background=new T.Color('#abc4ca');scene.add(new T.HemisphereLight('#f4f4ff','#687456',2));
 const sun=new T.DirectionalLight('#fff0d0',3);sun.position.set(-10,20,15);scene.add(sun);
 const water=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#6e9b9e',roughness:.65}));water.rotation.x=-Math.PI/2;scene.add(water);
 for(const [slot,x] of [[3,-6],[30,6]]){const boat=GameScene.prototype.vehicle.call({},slot);boat.position.x=x;boat.userData.driver.visible=true;scene.add(boat);}
 const float=new T.Mesh(new T.BoxGeometry(1.6,.28,2.5),new T.MeshStandardMaterial({color:'#b49c6c'}));float.position.set(0,.18,1);scene.add(float);
 const person=createHuman();person.animate(0,0);person.group.position.set(0,.32,1);scene.add(person.group);
 const camera=new T.OrthographicCamera(-16,16,11,-11,.1,300);camera.position.set(0,25,25);camera.lookAt(0,1.5,0);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1100);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);renderer.render(scene,camera);window.ready=true;
 </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__boat_sizes');
  await page.waitForFunction(() => (window as any).ready);
  await page.screenshot({ path: output + '/boat-size-comparison.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved ' + output + '/boat-size-comparison.png');
} finally {
  await browser.close();
  await server.close();
}
