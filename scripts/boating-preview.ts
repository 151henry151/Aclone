// SPDX-License-Identifier: GPL-3.0-or-later
// Real game geometry at the generated public shoreline site; no live state changed.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__boating', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><style>body{margin:0}canvas{display:block}</style><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {GameScene} from '/src/client/scene.ts';
 import {buildingModel} from '/src/client/buildings.ts';
 import {fitBoatyardToWater} from '/src/client/boatyard.ts';
 import {createWorld} from '/src/shared/simulation.ts';
 import {ensurePuddlewickBoatyard} from '/src/server/puddlewick-boatyard.ts';
 import {terrainHeight} from '/src/shared/terrain.ts';
 import {boathouseSite} from '/src/shared/boathouse.ts';
 import {surface,waitForTextures} from '/src/client/materials.ts';
 const w=createWorld('puddlewick','Puddlewick','server');ensurePuddlewickBoatyard(w);
 const b=w.buildings.find(b=>b.id==='parish-boatyard'),site=boathouseSite(w,b);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1600,1100);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
 window.show=async(subject,rear=false)=>{
  const scene=new T.Scene();scene.background=new T.Color('#b6ced1');scene.add(new T.HemisphereLight('#f0f5ff','#7a8468',2.1));
  const sun=new T.DirectionalLight('#fff0cf',3);sun.position.set(-30,55,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,far:200});sun.shadow.normalBias=.025;scene.add(sun);
  const water=new T.Mesh(new T.PlaneGeometry(2000,2000),new T.MeshStandardMaterial({color:'#417b84',roughness:.37,metalness:.15}));water.rotation.x=-Math.PI/2;water.receiveShadow=true;scene.add(water);
  let model,center,extent;
  if(subject==='boathouse'){
   water.position.y=w.settings.seaLevel-b.foundationY;
   model=buildingModel(b);model.rotation.y=b.rotation;fitBoatyardToWater(model,b,w);scene.add(model);
   const terrain=new T.PlaneGeometry(200,200,150,150);terrain.rotateX(-Math.PI/2);const a=terrain.attributes.position;
   for(let i=0;i<a.count;i++)a.setY(i,terrainHeight(w,a.getX(i)+b.x,a.getZ(i)+b.z)-b.foundationY);terrain.computeVertexNormals();
   const ground=new T.Mesh(terrain,new T.MeshStandardMaterial({color:'#86975a',roughness:1}));surface(ground,'meadow',12,'#899b68');ground.receiveShadow=true;scene.add(ground);
   const canal=GameScene.prototype.vehicle.call({},3);canal.userData.driver.visible=false;canal.position.set(site.berth.x-b.x,water.position.y,site.berth.z-b.z);canal.rotation.y=site.heading;scene.add(canal);
   center=new T.Vector3(-3,2,10);extent=44;
  } else {
   const slot={canal:3,fishing:30,lifeboat:29}[subject];model=GameScene.prototype.vehicle.call({},slot);scene.add(model);if(model.userData.driver)model.userData.driver.visible=true;
   model.userData.row?.(.2,0);center=new T.Vector3(0,slot===29?.55:1.5,0);extent=slot===29?3.1:slot===30?13:9.5;
  }
  const camera=new T.OrthographicCamera(-extent,extent,extent*1100/1600,-extent*1100/1600,.1,2000);
  const direction=subject==='boathouse'?new T.Vector3(-.7,.75,1):new T.Vector3(rear?-1:1,.65,rear?-1:1.3);
  camera.position.copy(center).add(direction.normalize().multiplyScalar(160));camera.lookAt(center);
  await waitForTextures();renderer.render(scene,camera);
  let meshes=0,triangles=0;model.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
  return {subject,rear,meshes,triangles,draws:renderer.info.render.calls};
 };window.ready=true;</script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__boating');
  await page.waitForFunction(() => (window as any).ready);
  const metrics = [];
  for (const subject of ['boathouse', 'canal', 'fishing', 'lifeboat']) {
    metrics.push(await page.evaluate((s) => (window as any).show(s), subject));
    await page.screenshot({ path: join(output, subject + '.png') });
  }
  await page.evaluate(() => (window as any).show('boathouse', true));
  // The gallery offers all five architectural forms; this sheet is the public boatyard.
  const names = [
    'Puddlewick boatyard',
    'Parish Carrier · canal boat',
    'North Star · commercial fishing boat',
    'Emergency rowing lifeboat',
  ];
  const cards = ['boathouse', 'canal', 'fishing', 'lifeboat']
    .map(
      (s, i) =>
        '<article><h2>' +
        names[i] +
        '</h2><img src="data:image/png;base64,' +
        readFileSync(join(output, s + '.png')).toString('base64') +
        '"></article>',
    )
    .join('');
  await page.setViewportSize({ width: 2400, height: 2000 });
  await page.setContent(
    '<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:42px;background:#172c25;color:#f3eddc;font-family:Arial}.brand{font:italic bold 38px Georgia;color:#d6bf77}h1{font:normal 50px Georgia;margin:12px 0 26px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{border:1px solid #536354;border-radius:12px;overflow:hidden;background:#243b30}h2{font:normal 28px Georgia;margin:20px 24px}img{display:block;width:100%}footer{font-size:23px;color:#c3cdbd;margin-top:28px}</style><div class="brand">Aclone</div><h1>Life on the water</h1><div class="grid">' +
      cards +
      '</div><footer>Actual game models · Shoreline boatyards, deep-water fishing and rowing rescues</footer>',
  );
  await page
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
  await page.screenshot({ path: join(output, 'boating-collage.png'), fullPage: true });
  writeFileSync(join(output, 'metrics.json'), JSON.stringify({ metrics, errors }, null, 2));
  console.log(JSON.stringify({ metrics, errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
