// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('trawl deployment, capacity cues and staged haul remain attached and lightweight', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.route('**/__rig', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import {createFishingBoat} from '/src/client/fishing-boat.ts';
      import {seaMaterial} from '/src/client/sea-material.ts';
      const boat=createFishingBoat(),root=boat.group;
      const rig=root.getObjectByName('Otter trawl, towing warps and catch');
      const net=root.getObjectByName('Open mouth, tapered belly and closed codend');
      const gear=root.getObjectByName('Complete trawl net');
      const fish=root.getObjectByName('Catch glimpses, pouring fish and deck piles');
      const pos=net.geometry.attributes.position;
      if(gear.visible||fish.visible||root.getObjectByName('Water draining from lifted codend').visible)throw Error('Unanimated/moored boat must start with stowed gear');
      boat.animate(false,0,0,Infinity,0);
      const stowed=!gear.visible&&!fish.visible;
      for(let i=0;i<300;i++)boat.animate(true,4,i/30,Infinity,0,2.4,0,1/30);
      let mouthMin=Infinity,tailMax=-Infinity,underwater=true;
      for(let i=0;i<33;i++)mouthMin=Math.min(mouthMin,pos.getZ(i));
      for(let i=pos.count-33;i<pos.count;i++)tailMax=Math.max(tailMax,pos.getZ(i));
      for(let i=0;i<pos.count;i++)underwater&&=pos.getY(i)<0;
      const closed=Array.from({length:33},(_,i)=>new T.Vector3().fromBufferAttribute(pos,pos.count-33+i)).every(v=>v.distanceTo(new T.Vector3().fromBufferAttribute(pos,pos.count-1))<1e-5);
      const towing=gear.visible&&fish.count===28&&mouthMin>tailMax&&underwater&&closed;
      const before=Array.from(pos.array);
      for(let i=0;i<30;i++)boat.animate(true,4,10+i/30,Infinity,0,2.4,.008,1/30);
      const sway=before.some((v,i)=>Math.abs(v-pos.array[i])>.03);
      boat.animate(false,4,11,Infinity,0,0,0,1/30);
      const paused=gear.visible&&fish.count===28;
      const phases=[];
      for(let i=0;i<=390;i++){
        const age=i/30;boat.animate(false,0,12+age,age,.6,0,0,1/30);
        if(i%90===0)phases.push(rig.userData.phase);
        if(!Array.from(pos.array).every(Number.isFinite))throw Error('Non-finite animated vertex');
        if(fish.count>100)throw Error('Instance capacity exceeded');
      }
      const stowedAgain=!gear.visible;
      boat.animate(true,4,26,Infinity,.6,2.4,0,1/30);
      for(let i=0;i<300;i++)boat.animate(true,4,26+i/30,Infinity,.6,2.4,0,1/30);
      const scene=new T.Scene();scene.add(root,new T.HemisphereLight(0xffffff,0x667777,3));
      const water=new T.Mesh(new T.PlaneGeometry(200,200),seaMaterial());water.rotation.x=-Math.PI/2;scene.add(water);
      const camera=new T.PerspectiveCamera(50,1,.1,200);camera.position.set(40,30,20);camera.lookAt(0,0,-15);
      const renderer=new T.WebGLRenderer();renderer.setSize(600,600);document.body.append(renderer.domElement);renderer.render(scene,camera);
      window.result={stowed,towing,sway,paused,phases,stowedAgain,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__rig');
    await page.waitForFunction(() => !!(window as any).result);
    const result = await page.evaluate(() => (window as any).result);
    expect(result).toMatchObject({
      stowed: true,
      towing: true,
      sway: true,
      paused: true,
      stowedAgain: true,
    });
    expect(result.phases).toEqual(['retrieving', 'lifting', 'emptying', 'stowing', 'stowed']);
    expect(result.calls).toBeLessThan(45);
    expect(result.triangles).toBeLessThan(30000);
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});
