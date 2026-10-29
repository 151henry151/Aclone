// SPDX-License-Identifier: GPL-3.0-or-later
// Render the actual game factory, including its helm camera and paint handling.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const charter = process.argv.includes('--charter');
const commercial = process.argv.includes('--fishing');
const output =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  (charter ? 'output/charter-boat' : commercial ? 'output/fishing-boat' : 'output/canal-boat');
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
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.stack);
  });
  await page.route('**/__canalboat', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
  globalThis.__ACLONE_BASE__='/';
  import * as T from '/node_modules/three/build/three.module.js';
  import {GameScene} from '/src/client/scene.ts';
  import {FishingLightPool} from '/src/client/fishing-lights.ts';
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,900);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#adc6cb');const ambient=new T.HemisphereLight('#edf3ff','#68764e',2);scene.add(ambient);
  const sun=new T.DirectionalLight('#ffebc9',2.8);sun.position.set(-8,14,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10});sun.shadow.normalBias=.025;scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(1000,1000),new T.MeshStandardMaterial({color:'#4c838a',roughness:.4,metalness:.1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.015;scene.add(ground);
  const plane=GameScene.prototype.vehicle.call({},${charter ? 31 : commercial ? 30 : 3});scene.add(plane);plane.position.y=0;window.plane=plane;
  const pool=new FishingLightPool();scene.add(pool.group);
  let clock=1;
  window.show=(view)=>{const night=view.includes('night')||view==='red';const inside=['cockpit','night-helm','red'].includes(view);plane.userData.driver.visible=!inside;let camera;
    ambient.intensity=night?.12:2;sun.intensity=night?.035:2.8;scene.background.set(night?'#102633':'#adc6cb');
    if(inside){const eye=plane.userData.eye;camera=new T.PerspectiveCamera(60,1400/900,.05,100);camera.position.copy(eye).add(plane.position);camera.lookAt(eye.x,eye.y+Math.sin(plane.userData.viewPitch)*30,eye.z+30);}
    else{camera=new T.OrthographicCamera(-${commercial ? 13 : 9.5},${commercial ? 13 : 9.5},${commercial ? 8.36 : 6.107},-${commercial ? 8.36 : 6.107},.1,100);camera.position.set(...({front:[8,5,10],rear:[-8,5,-10],side:[12,3.4,0],top:[0,15,.01]}[night?'rear':view]));camera.lookAt(0,2,0);}
    const boat=plane.userData.charterBoat??plane.userData.canalBoat??plane.userData.fishingBoat;
    const p={heading:Math.PI/4,speed:3,fuel:${charter ? 150 : commercial ? 2400 : 48},engine:true,boatThrottle:.6,boatLighting:{deck:night,cabin:view==='red'?'red':night?'warm':'off'}};
    boat.cockpit?.update(p,clock++,.6);boat.lighting.update(boat.group,camera.position,p);pool.update([{root:boat.group,player:p}],camera.position);
    renderer.render(scene,camera);
    let meshes=0,triangles=0;plane.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {meshes,triangles,draws:renderer.info.render.calls};
  };window.ready=true;
  </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__canalboat');
  await page.waitForFunction(() => (window as any).ready);
  const metrics = [];
  for (const view of [
    'front',
    'rear',
    'side',
    'top',
    'cockpit',
    'night-helm',
    'night-exterior',
    'red',
  ]) {
    metrics.push({ view, ...(await page.evaluate((v) => (window as any).show(v), view)) });
    await page.screenshot({ path: join(output, view + '.png') });
  }
  const names = ['Front quarter', 'Rear quarter', 'Side profile', 'Steering position'];
  const cards = ['front', 'rear', 'side', 'cockpit']
    .map(
      (view, i) =>
        `<article><h2>${names[i]}</h2><img src="data:image/png;base64,${readFileSync(join(output, view + '.png')).toString('base64')}"></article>`,
    )
    .join('');
  await page.setViewportSize({ width: 2400, height: 1900 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:44px;background:#172c25;color:#f3eddc;font-family:Arial,sans-serif}.brand{font:italic bold 40px Georgia;color:#d6bf77}h1{font:normal 54px Georgia;margin:10px 0 24px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}article{overflow:hidden;border:1px solid #536354;border-radius:10px;background:#243b30}h2{font:normal 28px Georgia;margin:20px 24px}img{display:block;width:100%}footer{font-size:23px;color:#c3cdbd;margin-top:28px}</style><div class="brand">Aclone</div><h1>${charter ? 'Coastal Belle · charter fishing boat' : commercial ? 'North Star · commercial fishing boat' : 'Parish Carrier · passenger & angling cruiser'}</h1><div class="grid">${cards}</div><footer>Actual game model · Exterior and helm views</footer>`,
  );
  await page
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
  await page.setViewportSize({
    width: 2400,
    height: Math.ceil(await page.evaluate(() => document.body.getBoundingClientRect().height)),
  });
  await page.screenshot({
    path: join(output, charter ? 'charter-boat-review.png' : 'canal-boat-review.png'),
    fullPage: true,
  });
  writeFileSync(join(output, 'metrics.json'), JSON.stringify({ metrics, errors }, null, 2));
  console.log(JSON.stringify({ metrics, errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
