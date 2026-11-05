// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createWorld } from '../../src/shared/simulation';
import { ensurePuddlewickSpaceport } from '../../src/server/puddlewick-spaceport';

test('spaceport razor wire shares fence lighting and disappears into the dark from ground and air', async ({
  page,
}) => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  ensurePuddlewickSpaceport(w);
  const vite = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.route('**/__wire', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `
      <style>body{margin:0;background:black}</style><script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import {spaceportFence} from '/src/client/spaceport-fence.ts';
      import {spaceportFences} from '/src/shared/spaceport-site.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      import {batchStaticScenery,freezeScenery} from '/src/client/static-scene.ts';
      const w=${JSON.stringify(w)}, fence=spaceportFence(w),scene=new T.Scene();
      const wire=fence.children.filter(o=>o.isLineSegments||o.name==='Concertina razor wire');
      const fabric=fence.children.find(o=>o.material?.map);
      window.materials={lit:wire.every(o=>o.material.isMeshStandardMaterial),same:wire.every(o=>o.material.roughness===fabric.material.roughness&&o.material.metalness===fabric.material.metalness&&o.material.emissive?.getHex()===0),empty:spaceportFence({...w,spaceportSite:undefined}).children.length};
      const wireGroup=new T.Group();wireGroup.add(...wire);scene.add(wireGroup);
      batchStaticScenery(wireGroup);freezeScenery(wireGroup,[]);
      const hemi=new T.HemisphereLight(0xffffff,0x555555,2),sun=new T.DirectionalLight(0xffffff,3);sun.position.set(100,200,100);scene.add(hemi,sun);
      const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,700);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
      const camera=new T.PerspectiveCamera(45,1000/700,.1,10000),edge=spaceportFences(w)[30];
      const x=(edge.a.x+edge.b.x)/2,z=(edge.a.z+edge.b.z)/2,h=terrainHeight(w,x,z)+8;
      const outward=new T.Vector3(x-w.spaceportSite.x,0,z-w.spaceportSite.z).normalize();
      window.show=(mode)=>{
        const distance=mode.includes('air')?1200:18;
        camera.position.set(x+outward.x*distance,h+(mode.includes('air')?500:2),z+outward.z*distance);camera.lookAt(x,h,z);
        hemi.intensity=mode==='day'?2:mode==='dark'?0:.06;sun.intensity=mode==='day'?3:0;
        renderer.render(scene,camera);
        const gl=renderer.getContext(),pixels=new Uint8Array(1000*700*4);gl.readPixels(0,0,1000,700,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let peak=0,bright=0,visible=0;for(let i=0;i<pixels.length;i+=4){const v=Math.max(pixels[i],pixels[i+1],pixels[i+2]);peak=Math.max(peak,v);if(v>100)bright++;if(v>3)visible++;}
        return {peak,bright,visible,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      };window.ready=true;
      </script>`,
      }),
    );
    await page.goto(vite.resolvedUrls!.local[0] + '__wire');
    await page.waitForFunction(() => !!(window as any).ready);
    const samples: Record<
      string,
      { peak: number; bright: number; visible: number; draws: number; triangles: number }
    > = {};
    for (const mode of ['day', 'dark', 'night-ground', 'night-air']) {
      samples[mode] = await page.evaluate((mode) => (window as any).show(mode), mode);
      await page.screenshot({ path: `test-results/spaceport-wire-${mode}.png` });
    }
    console.log('Wire lighting', samples);
    expect(samples.day.visible).toBeGreaterThan(100);
    expect(
      samples.dark.peak,
      'wire must not emit light without scene lighting',
    ).toBeLessThanOrEqual(2);
    expect(samples['night-ground'].peak).toBeLessThan(samples.day.peak * 0.5);
    expect(samples['night-air'].bright).toBe(0);
    expect(samples.day.triangles).toBeLessThan(600000);
    expect(samples.day.draws).toBeLessThanOrEqual(12);
    expect(await page.evaluate(() => (window as any).materials)).toEqual({
      lit: true,
      same: true,
      empty: 0,
    });
    expect(errors).toEqual([]);
  } finally {
    await vite.close();
  }
});
