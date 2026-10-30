// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const output = 'output/rescue-fleet';
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    process.env.TEST_GPU ? '--use-angle=gl' : '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__rescue_fleet', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#c5d9dc}canvas{display:block}header{position:absolute;top:25px;left:35px;color:#193c3f;font:24px Arial}small{display:block;font-size:16px;margin-top:8px}</style><header id="title"></header><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {createTugboat} from '/src/client/tugboat.ts';
 import {createFishingBoat} from '/src/client/fishing-boat.ts';
 import {createCanalBoat} from '/src/client/canal-boat.ts';
 import {createHuman} from '/src/client/human.ts';
 import {createMotorboat} from '/src/client/motorboat.ts';
 import {createTrailer} from '/src/client/trailer-model.ts';
 import {trailerDefs} from '/src/shared/trailers.ts';
 import {tractor} from '/src/client/tractor.ts';
 const scene=new T.Scene();scene.background=new T.Color('#c5d9dc');scene.add(new T.HemisphereLight('#fff9e9','#536f73',2));const sun=new T.DirectionalLight('#fff1d1',3);sun.position.set(-10,25,8);scene.add(sun);
 const sea=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:'#356d79',roughness:.5}));sea.rotation.x=-Math.PI/2;scene.add(sea);
 const models=new T.Group();scene.add(models);const camera=new T.PerspectiveCamera(40,1.6,.1,500);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1000);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
 window.view=(mode)=>{models.clear();if(mode==='motor'){const boat=createMotorboat();models.add(boat.group);camera.position.set(6,4,6);camera.lookAt(0,.35,0);document.querySelector('#title').innerHTML='Outboard motorboat<small>4.3 m long · 50 cargo · 24s · rowing when the tank is empty</small>';}else if(mode.startsWith('trailer:')){const kind=mode.slice(8),cargo={hay:{hay:300},livestock:{cows:2},logs:{wood:200},dump:{stone:500}}[kind]??{};const trailer=createTrailer(kind,cargo);models.add(trailer);trailer.position.y=.05;const human=createHuman().group;human.position.set(3,.05,2);models.add(human);sea.material.color.set('#8a9a78');camera.position.set(10,6,11);camera.lookAt(0,1,0);document.querySelector('#title').innerHTML=trailerDefs[kind].name+'<small>'+trailerDefs[kind].length+' m load bed · '+trailerDefs[kind].capacity+' weight capacity</small>';}else if(mode==='tug'||mode==='cab'){const tug=createTugboat();models.add(tug.group);if(mode==='cab'){tug.group.userData.driver.visible=false;camera.position.copy(tug.group.userData.eye);camera.lookAt(.48,1.9,7);document.querySelector('#title').innerHTML='Breakwater — working wheelhouse';}else{camera.position.set(18,12,18);camera.lookAt(0,1,0);document.querySelector('#title').innerHTML='Breakwater coastal tug<small>16.8 m long · 5.94 m beam · 140s · human-sized helm and deck fittings</small>';}}
 else {for(const [factory,x] of [[createCanalBoat,-12],[createTugboat,0],[createFishingBoat,12]]){const boat=factory();boat.group.position.x=x;models.add(boat.group);}const person=createHuman();person.group.position.set(-7,0,12);models.add(person.group);const pontoon=new T.Mesh(new T.BoxGeometry(2,.2,3),new T.MeshStandardMaterial({color:'#a2936d'}));pontoon.position.set(-7,-.1,12);models.add(pontoon);camera.position.set(29,38,43);camera.lookAt(0,0,0);document.querySelector('#title').innerHTML='Canal boat · Coastal tug · Offshore trawler<small>13.5 m · 16.8 m · 24.5 m — actual game models, one camera, normal-size crew</small>';}
 renderer.render(scene,camera);};window.view('tug');window.ready=true;
 </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__rescue_fleet');
  await page.waitForFunction(() => (window as any).ready);
  for (const view of [
    'tug',
    'cab',
    'fleet',
    'motor',
    'trailer:hay',
    'trailer:livestock',
    'trailer:dump',
    'trailer:logs',
    'trailer:tanker',
    'trailer:box',
    'trailer:fish',
  ]) {
    await page.evaluate((v) => (window as any).view(v), view);
    await page.screenshot({ path: `${output}/${view.replace(':', '-')}.png` });
  }
  if (errors.length) throw Error(errors.join('\n'));
  console.log(output);
} finally {
  await browser.close();
  await server.close();
}
