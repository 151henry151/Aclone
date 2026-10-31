// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const out = 'output/umbrella';
mkdirSync(out, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__umbrella', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<style>body{margin:0}canvas{display:block}</style><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {createHuman} from '/src/client/human.ts';import {createRainUmbrella} from '/src/client/umbrella.ts';import {createFlashlight} from '/src/client/flashlight.ts';import {Precipitation} from '/src/client/weather.ts';
 const scene=new T.Scene();scene.background=new T.Color('#8c9da6');scene.fog=new T.Fog('#8c9da6',12,45);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1280,960);renderer.shadowMap.enabled=true;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 scene.add(new T.HemisphereLight('#eaf4ff','#5a6552',1.8));const sun=new T.DirectionalLight('#eaf4ff',.7);sun.position.set(-4,7,5);sun.castShadow=true;sun.shadow.bias=-.0005;sun.shadow.normalBias=.02;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
 const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#687264',roughness:.48}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const root=new T.Group();scene.add(root);const human=createHuman();root.add(human.group);const umbrella=createRainUmbrella(human.group);root.add(umbrella.group);const torch=createFlashlight(human.group);
 const rain=new Precipitation();scene.add(rain.mesh);const camera=new T.PerspectiveCamera(36,1280/960,.05,100);camera.position.set(3.1,3.3,4.8);camera.lookAt(0,1.2,0);
 let time=0;window.step=(wet=true,walk=false,flash=false)=>{human.animate(walk?1.3/30:0,1/30);torch.update(flash);umbrella.update(wet,1/30);time+=1/30;rain.shelter(umbrella.shelter());rain.update(1/30,camera.position,wet?'rain':'clear',1,1);renderer.render(scene,camera);};
 window.view=(which)=>{if(which==='print'){camera.position.set(1.7,4.8,2.6);camera.lookAt(.1,1.8,0);}else if(which==='eye'){human.group.visible=false;camera.position.set(0,1.66,.12);camera.lookAt(0,1.75,5);}else{human.group.visible=true;camera.position.set(3.1,3.3,4.8);camera.lookAt(0,1.2,0);}renderer.render(scene,camera);};window.ready=true;
 </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__umbrella');
  await page.waitForFunction(() => (window as any).ready);
  for (let i = 0; i < 45; i++) await page.evaluate(() => (window as any).step(true, true, true));
  await page.screenshot({ path: out + '/walking-rain.png' });
  await page.evaluate(() => (window as any).view('print'));
  await page.screenshot({ path: out + '/canopy-print.png' });
  await page.evaluate(() => (window as any).view('eye'));
  await page.screenshot({ path: out + '/first-person.png' });
  await page.evaluate(() => (window as any).view('walk'));
  for (let i = 0; i < 40; i++) await page.evaluate(() => (window as any).step(false));
  // A fixed-step clip shows opening, walking with a torch, and closing in real time.
  mkdirSync(out + '/frames', { recursive: true });
  for (let i = 0; i < (process.argv.includes('--stills') ? 0 : 180); i++) {
    await page.evaluate(
      (i) => (window as any).step(i >= 15 && i < 130, i >= 55 && i < 125, i >= 80 && i < 125),
      i,
    );
    await page.screenshot({ path: out + '/frames/' + String(i).padStart(4, '0') + '.png' });
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Umbrella captures complete');
} finally {
  await browser.close();
  await server.close();
}
