// SPDX-License-Identifier: GPL-3.0-or-later
// Render the real game boat/rig locally. No production account or world is accessed.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/trawl-rig';
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
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  recordVideo: { dir: output, size: { width: 1440, height: 960 } },
});
try {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__trawl', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#214b50;color:#f4e9cb;font-family:Arial}canvas{display:block}header{position:absolute;top:28px;left:32px;text-shadow:0 2px 8px #183f46}h1{font:36px Georgia;margin:0 0 10px}p{margin:5px 0;font-size:16px}footer{position:absolute;bottom:25px;left:32px;font:16px Arial}#stage{font-weight:bold;color:#ffe1a0}
</style><header><h1>Aclone · Working trawl gear</h1><p id="stage">Towing · enclosed net and trailing catch bag</p><p>Actual game model · local visual preview</p></header><footer id="caption">Wide mouth toward the boat · catch bag trails behind · floats and spreading boards hold the opening</footer><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import {createFishingBoat} from '/src/client/fishing-boat.ts';
import {seaMaterial} from '/src/client/sea-material.ts';
const scene=new T.Scene();scene.background=new T.Color('#66969c');
scene.add(new T.HemisphereLight('#e2f3f5','#526965',2.1));
const sun=new T.DirectionalLight('#fff1cc',3);sun.position.set(-30,55,25);scene.add(sun);
let boat=createFishingBoat();scene.add(boat.group);
const water=new T.Mesh(new T.PlaneGeometry(2000,2000),seaMaterial());water.rotation.x=-Math.PI/2;scene.add(water);
const camera=new T.OrthographicCamera(-33,33,22,-22,.1,1000);camera.position.set(45,42,27);camera.lookAt(0,0,-16);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,960);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
let time=0;
window.show=(stage,age=0)=>{
 water.visible=stage!=='inspection';
 if(stage==='haul'){camera.left=-13;camera.right=13;camera.top=8.67;camera.bottom=-8.67;camera.position.set(19,13,-22);camera.lookAt(0,1,-3);}
 else {camera.left=-33;camera.right=33;camera.top=22;camera.bottom=-22;camera.position.set(45,42,27);camera.lookAt(0,0,-16);}
 camera.updateProjectionMatrix();
 const deployed=stage==='towing'||stage==='inspection',activity=deployed||stage==='paused'?4:0;
 boat.animate(deployed,activity,time,stage==='haul'?age:Infinity,stage==='haul'?.6:0,stage==='paused'?0:2.4,0,1/30);
 renderer.render(scene,camera);time+=1/30;
 document.getElementById('stage').textContent={towing:'Towing · submerged, complete net',inspection:'Net construction · water hidden for inspection',paused:'Paused towing · catch retained in the net',haul:age<3?'Hauling · retrieving the gear':age<6?'Hauling · lifting the codend':age<9?'Hauling · draining and emptying the catch':'Hauling · winding gear onto the drum',stowed:'Nets stowed'}[stage];
 document.getElementById('caption').textContent=stage==='inspection'?'Inspection view only: gameplay retains the water surface.':stage==='haul'?'Retrieve → lift → drain → empty → stow':'Wide mouth toward the boat · catch bag trails behind · floats and spreading boards hold the opening';
 return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,phase:boat.group.getObjectByName('Otter trawl, towing warps and catch').userData.phase};
};
window.demo=()=>{scene.remove(boat.group);boat=createFishingBoat();scene.add(boat.group);let start=performance.now();function frame(now){const age=(now-start)/1000;window.show(age<3?'towing':'haul',Math.max(0,age-3));if(age<16)requestAnimationFrame(frame);else window.done=true;}requestAnimationFrame(frame);};
window.show('towing');window.ready=true;
</script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__trawl');
  await page.waitForFunction(() => (window as any).ready);
  const metrics = [];
  for (const [stage, age, name] of [
    ['towing', 0, 'towing'],
    ['inspection', 0, 'net-inspection'],
    ['paused', 0, 'paused'],
    ['haul', 5.8, 'lifting'],
    ['haul', 7.3, 'emptying'],
  ] as const) {
    metrics.push(await page.evaluate(([s, a]) => (window as any).show(s, a), [stage, age]));
    await page.screenshot({ path: output + '/' + name + '.png' });
  }
  await page.evaluate(() => {
    (window as any).show('towing');
    (window as any).demo();
  });
  await page.waitForFunction(() => (window as any).done, undefined, { timeout: 30000 });
  await page.screenshot({ path: output + '/stowed.png' });
  const video = page.video()!;
  await context.close();
  await video.saveAs(output + '/trawl-animation.webm');
  writeFileSync(output + '/metrics.json', JSON.stringify({ metrics, errors }, null, 2));
  console.log(JSON.stringify({ metrics, errors }));
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await context.close();
  await browser.close();
  await server.close();
}
