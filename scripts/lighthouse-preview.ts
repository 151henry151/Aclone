// SPDX-License-Identifier: GPL-3.0-or-later
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const dir = 'output/lighthouses';
mkdirSync(dir, { recursive: true });
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__lights', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import {GameScene} from '/src/client/scene.ts';
 import {createWorld,addPlayer} from '/src/shared/simulation.ts';
 import {ensurePuddlewickLighthouses} from '/src/server/puddlewick-lighthouses.ts';
 import {defaultCreator} from '/src/shared/creator.ts';
 const w=createWorld('puddlewick','Puddlewick','server');ensurePuddlewickLighthouses(w);
 w.settings.time=80000;w.creator={...defaultCreator(),scenery:false,weather:'clear'};
 const light=w.buildings.find(b=>b.id==='parish-east-light');
 const p=addPlayer(w,'preview','Skipper');Object.assign(p,{x:light.x+70,z:light.z+100,vehicle:30,online:true,engine:false});
 const game=new GameScene(document.getElementById('view'));game.setWorld(w,p.id);
 window.ready=()=>game.ready;window.game=game;
 window.verifyRotor=()=>{game.renderer.setAnimationLoop(null);game.motionClock.sample=()=>w.time;w.time=0;game.renderTime=0;game.frame(true);const rotor=game.buildingMeshes.find(m=>m.userData.lighthouseRotor)?.userData.lighthouseRotor;const before=rotor.matrix.elements.slice();w.time=2;game.renderTime=0;game.frame(true);if(before.every((v,i)=>v===rotor.matrix.elements[i]))throw Error('Lighthouse rotor is frozen');return true;};
 window.shot=(day,distance=1)=>{game.renderer.setAnimationLoop(null);w.settings.time=day?43000:80000;
 game.renderTime=0;game.frame(true);game.camera.position.set(light.x+70*distance,light.foundationY+20,light.z+110*distance);game.camera.lookAt(light.x,light.foundationY+12,light.z);
 const rotor=game.buildingMeshes.find(m=>m.userData.lighthouseRotor&&Math.abs(m.position.x-light.x)<1)?.userData.lighthouseRotor;
 if(!rotor)throw Error('Missing animated lighthouse');rotor.rotation.y=0;rotor.updateMatrixWorld(true);
 game.sky.position.copy(game.camera.position);game.renderer.render(game.scene,game.camera);return {lights:w.buildings.filter(b=>b.kind==='lighthouse').map(b=>({name:b.name,x:b.x,z:b.z})),beam:rotor.children.length};};
 </script>`,
    }),
  );
  await page.goto(server.resolvedUrls!.local[0] + '__lights');
  await page.waitForFunction(() => (window as any).ready?.(), undefined, { timeout: 120000 });
  await page.evaluate(() => (window as any).verifyRotor());
  for (const [name, day, distance] of [
    ['night', false, 1],
    ['day', true, 1],
    ['navigation', false, 10],
  ] as const) {
    console.log(
      await page.evaluate(
        ([day, distance]) => (window as any).shot(day, distance),
        [day, distance],
      ),
    );
    await page.screenshot({ path: dir + '/' + name + '.png' });
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await server.close();
}
