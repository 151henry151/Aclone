// SPDX-License-Identifier: GPL-3.0-or-later
// Actual game meshes, rendered at the same orthographic scale from two angles.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vehicles } from '../src/shared/catalog.ts';
import { tractorRoles } from '../src/shared/tractors.ts';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/tractors';
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { port: 4193, host: '127.0.0.1' } });
await server.listen();
const origin = server.resolvedUrls!.local[0];
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const slots = [0, 24, 25, 26, 27, 28];
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__tractors', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#b4beb4}#caption{position:absolute;left:40px;top:28px;color:#263c34;font:24px Georgia}small{display:block;font:14px sans-serif;margin-top:8px}canvas{display:block}</style><div id="caption"></div><script type="module">
  globalThis.__ACLONE_BASE__='/';
  import * as T from '/node_modules/three/build/three.module.js';
  import {fleetTractor} from '/src/client/tractor-fleet.ts';
  import {updateTractorCockpit} from '/src/client/tractor-cockpit.ts';
  import {vehicles} from '/src/shared/catalog.ts';import {tractorRoles} from '/src/shared/tractors.ts';
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,820);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#b4beb4');const ambient=new T.HemisphereLight('#edf3ff','#68764e',2);scene.add(ambient);
  const sun=new T.DirectionalLight('#ffebc9',2.8);sun.position.set(-6,10,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-6;sun.shadow.camera.right=6;sun.shadow.camera.top=6;sun.shadow.camera.bottom=-6;sun.shadow.normalBias=.025;scene.add(sun);
  const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#9aa48c',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.015;scene.add(ground);
  const camera=new T.OrthographicCamera(-4.5,4.5,3.075,-3.075,.1,100);let group;
  window.show=(slot,back=false)=>{scene.background.set('#b4beb4');ambient.intensity=2;sun.intensity=2.8;ground.material.color.set('#9aa48c');if(group){scene.remove(group);group.traverse(o=>{if(o.isMesh&&!o.geometry.userData.shared)o.geometry.dispose();});}group=new T.Group();fleetTractor(group,slot);scene.add(group);camera.position.set(back?-7:7,4.6,back?-8:8);camera.lookAt(0,1.3,0);document.querySelector('#caption').innerHTML=vehicles[slot].name+'<small>'+tractorRoles[slot].role+' · actual game model · common scale</small>';renderer.render(scene,camera);let modelTriangles=0,meshes=0;group.traverse(o=>{if(o.isMesh){meshes++;modelTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {slot,name:vehicles[slot].name,modelTriangles,meshes,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,children:group.children.length};};
  window.cockpit=(slot,night=false)=>{window.show(slot);group.userData.driver.visible=false;const eye=group.userData.eye;const pov=new T.PerspectiveCamera(53,1200/820,.1,100);pov.position.copy(eye);pov.lookAt(eye.clone().add(new T.Vector3(0,Math.sin(group.userData.viewPitch??0)*30,Math.cos(group.userData.viewPitch??0)*30)));scene.background.set(night?'#14202d':'#a1bfd0');ambient.intensity=night?.15:2;sun.intensity=night?.08:2.8;ground.material.color.set('#65724f');updateTractorCockpit(group,{vehicle:slot,fuel:vehicles[slot].tank*.68,speed:8,engine:true,lights:night,fleetState:{[slot]:{metres:12600,condition:92}}},1);document.querySelector('#caption').style.color=night?'#ede5ca':'#263c34';document.querySelector('#caption').innerHTML=vehicles[slot].name+'<small>Driver’s eye · '+(night?'illuminated instruments':'daylight')+' · actual cockpit geometry</small>';renderer.render(scene,pov);};window.ready=true;
  </script>`,
    }),
  );
  await page.goto(origin + '__tractors');
  await page.waitForFunction(() => !!(window as any).ready);
  const metrics = [];
  async function cleanShot(name: string) {
    await page.locator('#caption').evaluate((el) => (el.style.visibility = 'hidden'));
    await page.screenshot({ path: join(output, name) });
    await page.locator('#caption').evaluate((el) => (el.style.visibility = 'visible'));
  }
  for (const slot of slots) {
    metrics.push(await page.evaluate((s) => (window as any).show(s), slot));
    await page.screenshot({ path: join(output, `tractor-${slot}.png`) });
    await cleanShot(`tractor-${slot}-clean.png`);
    await page.evaluate((s) => (window as any).show(s, true), slot);
    await page.screenshot({ path: join(output, `tractor-${slot}-rear.png`) });
  }
  for (const slot of slots) {
    await page.evaluate((s) => (window as any).cockpit(s), slot);
    await page.screenshot({ path: join(output, `cockpit-${slot}.png`) });
    await cleanShot(`cockpit-${slot}-clean.png`);
  }
  await page.evaluate(() => (window as any).cockpit(28, true));
  await page.screenshot({ path: join(output, 'cockpit-28-night.png') });
  writeFileSync(join(output, 'metrics.json'), JSON.stringify(metrics, null, 2));
  await page.setViewportSize({ width: 1800, height: 1000 });
  const cards = slots
    .map(
      (s) =>
        `<img src="data:image/png;base64,${readFileSync(join(output, `tractor-${s}.png`)).toString('base64')}">`,
    )
    .join('');
  await page.setContent(
    `<style>body{margin:0;background:#20392f;font:20px sans-serif;color:#eee8d0}h1{margin:20px 30px;font-size:28px}p{margin:0 30px 18px;font-size:16px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 12px 12px}img{width:100%;display:block}</style><h1>Six tractors. Six ways to make a living.</h1><p>Aclone · actual game models at the same scale · work in progress</p><div class="grid">${cards}</div>`,
  );
  await page.screenshot({ path: join(output, 'tractor-lineup.png'), fullPage: true });
  const embedded = (name: string) =>
    `data:image/png;base64,${readFileSync(join(output, name)).toString('base64')}`;
  const pairs = slots
    .map(
      (slot, i) => `<article>
    <header><span class="number">0${i + 1}</span><div><h2>${vehicles[slot].name}</h2><p>${tractorRoles[slot].role}</p></div></header>
    <figure><img src="${embedded(`tractor-${slot}-clean.png`)}"><figcaption>EXTERIOR</figcaption></figure>
    <figure><img src="${embedded(`cockpit-${slot}-clean.png`)}"><figcaption>DRIVER’S SEAT</figcaption></figure>
  </article>`,
    )
    .join('');
  await page.setViewportSize({ width: 2400, height: 2600 });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#172c25;color:#f3eddc;font-family:Arial,sans-serif;padding:48px}
    .masthead{display:flex;align-items:end;justify-content:space-between;margin-bottom:32px}
    .brand{font:italic bold 44px Georgia;color:#d6bf77;margin-bottom:12px}h1{font:normal 58px Georgia;margin:0}
    .intro{font-size:25px;line-height:1.5;text-align:right;color:#c3cdbd;margin:0}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
    article{overflow:hidden;border:1px solid #536354;border-radius:10px;background:#243b30}
    header{height:114px;display:flex;align-items:center;gap:22px;padding:22px 24px}
    .number{font:32px Georgia;color:#cfb972;border-right:1px solid #586955;padding-right:20px}
    h2{font:normal 35px Georgia;margin:0 0 9px}header p{font-size:21px;color:#bcc8b6;margin:0}
    figure{position:relative;margin:0;border-top:2px solid #243b30}img{display:block;width:100%;height:auto}
    figcaption{position:absolute;top:16px;left:16px;background:#172c25e8;color:#f3eddc;padding:9px 13px;border-radius:3px;font-size:16px;letter-spacing:2px}
    footer{display:flex;justify-content:space-between;align-items:center;font-size:23px;color:#b8c6b7;margin-top:30px;line-height:1.5}
    footer strong{color:#d6bf77;font-weight:normal}
  </style><div class="masthead"><div><div class="brand">Aclone</div><h1>Meet the tractor fleet.</h1></div><p class="intro">Six distinct machines. Inside and out.<br>Every machine can have its own paint colour.</p></div>
  <div class="grid">${pairs}</div><footer><span>Actual game models · Exteriors shown at a common scale<br>Textured instruments · Lightweight geometry</span><strong>DEVELOPMENT PREVIEW · NOT YET RELEASED</strong></footer>`);
  await page
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
  const height = await page.evaluate(() => document.body.getBoundingClientRect().height);
  await page.setViewportSize({ width: 2400, height: Math.ceil(height) });
  await page.screenshot({
    path: join(output, 'aclone-tractor-fleet-inside-out.png'),
    fullPage: true,
  });
  const pairedHtml = await page.content();
  for (const interior of [false, true]) {
    await page.setContent(pairedHtml);
    await page.evaluate((inside) => {
      for (const card of document.querySelectorAll('article'))
        card.querySelectorAll('figure')[inside ? 0 : 1].remove();
      document.querySelector('h1')!.textContent = inside
        ? 'Behind the wheel.'
        : 'Meet the tractor fleet.';
      document.querySelector('.intro')!.innerHTML = inside
        ? 'Six driver’s-seat views.<br>Rounded dashboards · Illuminated instruments'
        : 'Six distinct machines. Six ways to make a living.<br>Every machine can have its own paint colour.';
      document.querySelector('footer span')!.textContent = inside
        ? 'Actual cockpit models · Texture-based instruments · Lightweight geometry'
        : 'Actual game models · Common scale · Default paint colours shown';
    }, interior);
    await page
      .locator('img')
      .evaluateAll((imgs) => Promise.all(imgs.map((img) => (img as HTMLImageElement).decode())));
    const sheetHeight = await page.evaluate(() => document.body.getBoundingClientRect().height);
    await page.setViewportSize({ width: 2400, height: Math.ceil(sheetHeight) });
    await page.screenshot({
      path: join(output, `aclone-tractor-${interior ? 'interiors' : 'exteriors'}.png`),
      fullPage: true,
    });
  }
  console.log(JSON.stringify({ metrics, errors }));
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
