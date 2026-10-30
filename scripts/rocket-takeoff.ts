// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic recording of production flight effects. One simulated second per video second.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWorld } from '../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../src/server/puddlewick-spaceport';
const output = process.env.ROCKET_OUTPUT ?? 'output/rocket-takeoff';
mkdirSync(output, { recursive: true });
const w = process.env.ROCKET_WORLD
  ? JSON.parse(readFileSync(process.env.ROCKET_WORLD, 'utf8'))
  : createWorld('puddlewick', 'Puddlewick', 'server', 'economy');
w.settings.mapSize = 18500;
w.terrainMapSize = 12500;
ensurePuddlewickSpaceport(w);
const vite = await createServer({
  define: { __ACLONE_BASE__: JSON.stringify('/') },
  server: { host: '127.0.0.1', port: 0 },
});
await vite.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    ...(process.env.TEST_GPU === '1'
      ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
});
const errors: string[] = [];
let encoder: ReturnType<typeof spawn> | undefined;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors.push(m.text());
      console.error(m.text());
    }
  });
  await page.addInitScript(() => {
    (window as any).__ACLONE_BASE__ = '/';
  });
  await page.route('**/__takeoff', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta charset="utf-8"><style>body{margin:0}#label{position:absolute;left:25px;top:22px;color:#fff9e9;font:18px sans-serif;text-shadow:0 1px 4px #162119}small{font-size:12px;display:block;margin-top:6px}</style><div id="label"></div><script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import {spaceportModel} from '/src/client/spaceport.ts';
import {spaceportFence} from '/src/client/spaceport-fence.ts';
import {terrainHeight} from '/src/shared/terrain.ts';
import {spaceportFlight} from '/src/shared/spaceport-flight.ts';
import {groundMaterial} from '/src/client/materials.ts';
const w=${JSON.stringify(w)},s=w.spaceportSite,b=w.buildings.find(b=>b.id===s.building);
const scene=new T.Scene();scene.background=new T.Color('#8daec3');scene.fog=new T.Fog('#8daec3',2300,6000);scene.add(new T.HemisphereLight('#edf4ff','#626950',2));
const sun=new T.DirectionalLight('#fff2da',3);sun.position.set(-200,500,180);scene.add(sun);
const ground=new T.PlaneGeometry(4000,4000,240,240);ground.rotateX(-Math.PI/2);const a=ground.getAttribute('position');
for(let i=0;i<a.count;i++){const x=a.getX(i)+s.x,z=a.getZ(i)+s.z;a.setXYZ(i,x,terrainHeight(w,x,z),z);}ground.computeVertexNormals();
scene.add(new T.Mesh(ground,groundMaterial(w,{x:s.x-2000,z:s.z-2000,size:4000,pixels:1024})));
const port=spaceportModel();port.position.set(b.x,b.foundationY,b.z);scene.add(port,spaceportFence(w));
const camera=new T.PerspectiveCamera(46,1280/720,.2,20000),r=new T.WebGLRenderer({antialias:true});r.setSize(1280,720);r.toneMapping=T.ACESFilmicToneMapping;document.body.append(r.domElement);
const launch=spaceportFlight(w.id,0).next;
window.frame=t=>{port.userData.flight.update(w.id,launch+t);const f=spaceportFlight(w.id,launch+t),pull=Math.max(0,t-18)*9;
camera.position.set(s.x+330+pull*.35,s.height+90+pull*.25,s.z+620+pull);camera.lookAt(s.x,s.height+105+f.height*.5,s.z);
document.querySelector('#label').innerHTML='Puddlewick spaceport · T+'+t.toFixed(1)+' s<small>Local preview · production models and effects · normal flight speed</small>';r.render(scene,camera);return {calls:r.info.render.calls,triangles:r.info.render.triangles};};
const capture=document.createElement('canvas');capture.width=1280;capture.height=720;const ctx=capture.getContext('2d');
window.videoFrame=t=>{window.frame(t);ctx.drawImage(r.domElement,0,0);ctx.fillStyle='#fff9e9';ctx.shadowColor='#162119';ctx.shadowBlur=4;ctx.font='18px sans-serif';ctx.fillText('Puddlewick spaceport · T+'+t.toFixed(1)+' s',25,40);ctx.font='12px sans-serif';ctx.fillText('Local preview · production models and effects · normal flight speed',25,61);return capture.toDataURL('image/jpeg',.94).split(',')[1];};
await Promise.all([...(scene.children.filter(x=>x.isMesh).flatMap(x=>x.material.userData.warmTextures||[]))].map(t=>t.image?Promise.resolve():new Promise(resolve=>{const timer=setInterval(()=>{if(t.image){clearInterval(timer);resolve();}},30);setTimeout(()=>{clearInterval(timer);resolve();},5000);})));window.ready=true;
</script>`,
    }),
  );
  await page.goto(vite.resolvedUrls!.local[0] + '__takeoff');
  await page.waitForFunction(() => !!(window as any).ready);
  for (const t of [6, 16, 26, 40, 55, 275, 295]) {
    console.log(t, await page.evaluate((t) => (window as any).frame(t), t));
    await page.screenshot({ path: `${output}/time-${t}.png` });
  }
  if (process.env.ROCKET_STILLS !== '1') {
    const fps = 24,
      duration = 46;
    encoder = spawn(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-vcodec',
        'mjpeg',
        '-framerate',
        String(fps),
        '-i',
        'pipe:0',
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        `${output}/puddlewick_takeoff.mp4`,
      ],
      { stdio: ['pipe', 'ignore', 'inherit'] },
    );
    const finished = once(encoder, 'exit');
    for (let i = 0; i < fps * duration; i++) {
      const frame = Buffer.from(
        await page.evaluate((t) => (window as any).videoFrame(t), i / fps),
        'base64',
      );
      if (!encoder.stdin!.write(frame)) await once(encoder.stdin!, 'drain');
      if (i % (fps * 5) === 0) console.log(`Recorded ${i / fps}/${duration} seconds`);
    }
    encoder.stdin!.end();
    const [code] = await finished;
    if (code !== 0) throw Error('Video encoder failed: ' + code);
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  encoder?.stdin?.destroy();
  await browser.close();
  await vite.close();
}
