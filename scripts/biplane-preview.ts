// SPDX-License-Identifier: GPL-3.0-or-later
// Render the actual game factory, including its seated camera and paint handling.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/biplane';
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { port: 4196, host: '127.0.0.1' } });
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
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__biplane', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
  globalThis.__ACLONE_BASE__='/';
  import * as T from '/node_modules/three/build/three.module.js';
  import {GameScene} from '/src/client/scene.ts';
  import {updateBiplaneInstruments} from '/src/client/biplane.ts';
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#b4beb4');scene.add(new T.HemisphereLight('#edf3ff','#68764e',2));
  const sun=new T.DirectionalLight('#ffebc9',2.8);sun.position.set(-8,14,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10});sun.shadow.normalBias=.025;scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#9aa48c',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.015;scene.add(ground);
  const plane=GameScene.prototype.vehicle.call({},2);scene.add(plane);window.plane=plane;
  window.show=(view)=>{updateBiplaneInstruments(plane.userData.biplane.group,{vehicle:2,speed:0,fuel:44},0,1);plane.userData.driver.visible=view!=='cockpit';let camera;
    if(view==='cockpit'){const eye=plane.userData.eye;camera=new T.PerspectiveCamera(60,1400/900,.05,100);camera.position.copy(eye);camera.lookAt(eye.x,eye.y+Math.sin(plane.userData.viewPitch)*30,eye.z+30);}
    else{camera=new T.OrthographicCamera(-6,6,3.857,-3.857,.1,100);camera.position.set(...({front:[8,5,10],rear:[-8,5,-10],side:[12,3.4,0],top:[0,15,.01]}[view]));camera.lookAt(0,1.5,0);}
    renderer.render(scene,camera);
    let meshes=0,triangles=0;plane.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {meshes,triangles,draws:renderer.info.render.calls};
  };window.ready=true;
  </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__biplane');
  await page.waitForFunction(() => (window as any).ready);
  const metrics = [];
  for (const view of ['front', 'rear', 'side', 'top', 'cockpit']) {
    metrics.push({ view, ...(await page.evaluate((v) => (window as any).show(v), view)) });
    await page.screenshot({ path: join(output, view + '.png') });
  }
  const names = ['Front quarter', 'Rear quarter', 'Side profile', 'Pilot’s seat'];
  const cards = ['front', 'rear', 'side', 'cockpit']
    .map(
      (view, i) =>
        `<article><h2>${names[i]}</h2><img src="data:image/png;base64,${readFileSync(join(output, view + '.png')).toString('base64')}"></article>`,
    )
    .join('');
  await page.setViewportSize({ width: 2400, height: 1900 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:44px;background:#172c25;color:#f3eddc;font-family:Arial,sans-serif}.brand{font:italic bold 40px Georgia;color:#d6bf77}h1{font:normal 54px Georgia;margin:10px 0 24px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}article{overflow:hidden;border:1px solid #536354;border-radius:10px;background:#243b30}h2{font:normal 28px Georgia;margin:20px 24px}img{display:block;width:100%}footer{font-size:23px;color:#c3cdbd;margin-top:28px}</style><div class="brand">Aclone</div><h1>Parish air mail · the new biplane</h1><div class="grid">${cards}</div><footer>Actual game model · Exterior and pilot-seat views</footer>`,
  );
  await page
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
  await page.setViewportSize({
    width: 2400,
    height: Math.ceil(await page.evaluate(() => document.body.getBoundingClientRect().height)),
  });
  await page.screenshot({ path: join(output, 'biplane-review.png'), fullPage: true });
  writeFileSync(join(output, 'metrics.json'), JSON.stringify({ metrics, errors }, null, 2));
  console.log(JSON.stringify({ metrics, errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
