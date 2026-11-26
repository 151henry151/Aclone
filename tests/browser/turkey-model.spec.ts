// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('adult turkey and poult render with the shared game material and bounded geometry', async ({
  page,
}, testInfo) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-turkey-model-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    const port = await app.listen();
    await page.route('**/__turkey-model', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#b1c2bb}aside{position:absolute;left:36px;top:28px;color:#243a30;font:24px Georgia}small{display:block;font:14px sans-serif;margin-top:10px}</style>
<aside>Aclone · Turkeys & poults<small>Actual game models · preview lighting</small></aside>
<script type="module">
import * as T from '/node_modules/three/build/three.module.js';
import { animalModel, animalMaterial } from '/src/client/animal-model.ts';
import { livestockRules } from '/src/shared/livestock-rules.ts';
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#b1c2bb');scene.add(new T.HemisphereLight('#edf6ff','#52623a',2.5));
const sun=new T.DirectionalLight('#fff1d6',3);sun.position.set(4,6,5);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(100,100),new T.MeshStandardMaterial({color:'#79895a',roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const material=animalMaterial();
for(const young of [false,true]) {const group=new T.Group();for(const part of animalModel('turkeys')){const mesh=new T.Mesh(part.geometry,material);mesh.position.copy(part.pivot);if(young && part.motion==='tail')mesh.scale.setScalar(.25);if(young && part.motion==='head')mesh.scale.setScalar(1.18);group.add(mesh);}if(young)group.scale.setScalar(livestockRules().livestockYoungVisualScale);group.position.x=young?.8:-.35;group.rotation.y=young?-.25:.25;scene.add(group);}
const camera=new T.PerspectiveCamera(34,1440/900,.01,100);camera.position.set(2.4,1.5,3.8);camera.lookAt(.1,.55,0);renderer.render(scene,camera);
window.turkeyPreview={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
</script>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__turkey-model`);
    await page.waitForFunction(() => !!(window as any).turkeyPreview);
    const info = await page.evaluate(() => (window as any).turkeyPreview);
    expect(info.calls).toBeLessThanOrEqual(12);
    expect(info.triangles).toBeLessThan(17002);
    expect(info.triangles).toBeGreaterThan(1000);
    const path = testInfo.outputPath('turkeys-and-poult.png');
    await page.screenshot({ path });
    await testInfo.attach('turkey-model-preview', { path, contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
