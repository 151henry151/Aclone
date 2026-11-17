// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('batching painted fixed furniture preserves rendered pixels and reduces draws', async ({
  page,
}) => {
  const fixture = `      import * as T from 'three';
      import {batchInteriorProps} from '/src/client/interior-batching.ts';
      const scene=new T.Scene(), group=new T.Group(), principal=new T.Group(), detail=new T.Group();
      group.add(principal,detail);scene.add(group);group.rotation.y=.2;
      scene.add(new T.AmbientLight(0xffffff,2));
      const fixture=new T.Group();fixture.userData.fixedInteriorProp=true;principal.add(fixture);
      for (const [i,color] of ['#783c20','#157c93','#dab652','#465c3d'].entries()) {
        const m=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color,roughness:.8}));
        m.position.set(i*1.5-2.25,0,0);fixture.add(m);
      }
      const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
      renderer.setSize(384,256);renderer.setClearColor('#233229');
      const camera=new T.PerspectiveCamera(45,384/256,.1,50);camera.position.set(0,3,9);camera.lookAt(0,0,0);
      const target=new T.WebGLRenderTarget(384,256);
      const capture=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);
        const pixels=new Uint8Array(384*256*4);renderer.readRenderTargetPixels(target,0,0,384,256,pixels);
        const calls=renderer.info.render.calls;renderer.setRenderTarget(null);renderer.render(scene,camera);
        const image=new Image();image.src=renderer.domElement.toDataURL();document.querySelector('#views').append(image);
        return {pixels,calls};};
      const before=capture();batchInteriorProps({group,principal,detail,doors:[],volume:{}});const after=capture();
      let maxDifference=0;for(let i=0;i<before.pixels.length;i++)maxDifference=Math.max(maxDifference,Math.abs(before.pixels[i]-after.pixels[i]));
      window.result={before:before.calls,after:after.calls,maxDifference};
`;
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'batch-fixture',
        resolveId(id) {
          if (id === '/__batch-fixture.ts') return id;
        },
        load(id) {
          if (id === '/__batch-fixture.ts') return fixture;
        },
      },
    ],
  });
  await server.listen();
  try {
    await page.route('**/__batch', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
      <style>body{background:#233229;color:#eee;font:18px sans-serif}canvas,img{width:384px;height:256px}</style>
      <h1>Fixed furniture: original and batched</h1><div id="views"></div>
      <script type="module" src="/__batch-fixture.ts">
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__batch');
    await page.waitForFunction(() => !!(window as any).result);
    const result = await page.evaluate(() => (window as any).result);
    expect(result.before).toBe(4);
    expect(result.after).toBe(1);
    expect(result.maxDifference).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/interior-colour-batching.png' });
  } finally {
    await server.close();
  }
});
