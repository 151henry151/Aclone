// SPDX-License-Identifier: GPL-3.0-or-later
// Capture the actual walking rig at deterministic frame times; no live accounts.
import { chromium } from '@playwright/test';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-walking-'));
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/walking';
const frameCount = Number(process.env.HUMAN_PREVIEW_FRAMES ?? 180);
const profile = process.env.HUMAN_PREVIEW_PROFILE === 'true';
mkdirSync(join(output, 'frames'), { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true });
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
  const port = await app.listen();
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__walking_preview', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8">
    <style>body{margin:0;background:#c7d1c9;color:#253a30;font:17px system-ui}header{position:absolute;left:28px;top:22px}h1{margin:0;font-size:27px}small{display:block;margin-top:7px}footer{position:absolute;bottom:22px;width:100%;display:flex;text-align:center}footer span{width:50%}</style>
    <header><h1>A more natural stride</h1><small>Aclone · actual game character · 17 bones · one smooth mesh · recorded human motion</small></header>
    <footer><span>Walking · heel-to-toe steps</span><span>Jogging · longer stride, bent arms</span></footer>
    <script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import {createHuman} from '/src/client/human.ts';
      const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1000,720);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      const scene=new T.Scene();scene.background=new T.Color('#c7d1c9');scene.add(new T.HemisphereLight('#ffffff','#68766b',2));
      const sun=new T.DirectionalLight('#fff0da',3);sun.position.set(3,7,5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-4;sun.shadow.camera.right=4;sun.shadow.camera.top=4;sun.shadow.camera.bottom=-4;sun.shadow.normalBias=.015;scene.add(sun);
      const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshStandardMaterial({color:'#b1bfb0',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
      const camera=new T.OrthographicCamera(-2.6,2.6,1.872,-1.872,.1,30);camera.position.set(0,2.6,7);camera.lookAt(0,.9,0);
      const people=[createHuman(),createHuman()];people.forEach((p,i)=>{p.group.position.x=i?1.2:-1.2;p.group.rotation.y=-.9;scene.add(p.group);});
      window.profile=()=>{people.forEach(p=>p.group.rotation.y=-Math.PI/2);};
      window.frame=(index)=>{for(let i=0;i<2;i++)people[i].animate((i?3.8:1.4)/30,1/30);renderer.render(scene,camera);};
      window.transition=(index)=>{const t=index/30,speed=t<1?t*1.4:t<2.5?1.4:t<3?1.4*(3-t)*2:t<4?0:-.7;people.forEach(p=>p.animate(speed/30,1/30));document.querySelector('footer').innerHTML='<span>Start · walk · stop · reverse</span><span>Same motion, profile view</span>';people[1].group.rotation.y=-Math.PI/2;renderer.render(scene,camera);};
      // Settle blend-in for the repeating stride demonstration.
      for(let n=0;n<45;n++)window.frame(n);
      window.still=()=>{document.querySelector('footer').innerHTML='<span>Standing · front</span><span>Standing · three-quarter view</span>';people.forEach((p,i)=>{for(let n=0;n<120;n++)p.animate(0,1/60);p.group.rotation.y=i?-.95:0;});renderer.render(scene,camera);};
      window.reverseView=()=>{people.forEach((p,i)=>p.group.rotation.y=i?Math.PI*.5:Math.PI);document.querySelector('footer').innerHTML='<span>Rear view · joined shoulders and hips</span><span>Side view</span>';renderer.render(scene,camera);};
      window.seated=()=>{people.forEach(p=>scene.remove(p.group));const seated=createHuman('seated');seated.group.position.set(0,.8,0);seated.group.rotation.y=-.8;scene.add(seated.group);const chair=new T.Mesh(new T.BoxGeometry(.48,.08,.43),new T.MeshStandardMaterial({color:'#6b5842'}));chair.position.set(0,.75,0);chair.rotation.y=-.8;scene.add(chair);document.querySelector('footer').innerHTML='<span style="width:100%">Same continuous surface · baked seated driver pose</span>';renderer.render(scene,camera);};
      window.ready=true;
    </script>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__walking_preview`);
  await page.waitForFunction(() => (window as any).ready);
  if (profile) await page.evaluate(() => (window as any).profile());
  for (let frame = 0; frame < frameCount; frame++) {
    await page.evaluate((i) => (window as any).frame(i), frame);
    await page.screenshot({
      path: join(output, 'frames', `${String(frame).padStart(4, '0')}.png`),
    });
  }
  await page.screenshot({ path: join(output, 'walking-and-jogging.png') });
  await page.evaluate(() => (window as any).still());
  await page.screenshot({ path: join(output, 'standing-detail.png') });
  if (process.env.HUMAN_PREVIEW_TRANSITIONS === 'true') {
    mkdirSync(join(output, 'transitions'), { recursive: true });
    for (let frame = 0; frame < 180; frame++) {
      await page.evaluate((i) => (window as any).transition(i), frame);
      await page.screenshot({
        path: join(output, 'transitions', `${String(frame).padStart(4, '0')}.png`),
      });
    }
    await page.evaluate(() => (window as any).still());
  }
  await page.evaluate(() => (window as any).reverseView());
  await page.screenshot({ path: join(output, 'rear-side.png') });
  await page.evaluate(() => (window as any).seated());
  await page.screenshot({ path: join(output, 'seated.png') });
  if (errors.length) throw Error(errors.join('\n'));
  console.log(`Saved ${frameCount} frames at 30 fps to ${output}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
