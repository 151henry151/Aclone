// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('rendered trunk positions match shared solids in the village and streamed chunks at both qualities', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__solid-scenes', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<script>globalThis.__ACLONE_BASE__='/'</script><script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import { createWorld } from '/src/shared/simulation.ts';
      import { creatorSchema } from '/src/shared/creator.ts';
      import { sceneryChunk } from '/src/shared/scenery-obstacles.ts';
      import { countrysideSteps } from '/src/client/scenery.ts';
      import { CountrysideChunks } from '/src/client/countryside.ts';
      const w = createWorld('solid-render', 'Solid render', 'owner');
      w.buildings=[]; w.roads=[]; w.towns=[]; w.zones=[];
      Object.assign(w.settings,{mapSize:2000, seaLevel:-10});
      w.creator=creatorSchema.parse({roads:false,scenery:true});
      w.landscape={paths:[],surfaces:[],barriers:[],scatter:[],heightmap:Array(1089).fill(20)};
      const result=[];
      for(const low of [true,false]) {
        const root=new T.Group();
        for(const _ of countrysideSteps(root,w,low)) {}
        const streamed=new CountrysideChunks(); streamed.reset(w,low);
        const job=streamed.build(w,1,1); let step; do { step=job.next(); } while(!step.done);
        root.add(streamed.group); root.updateMatrixWorld(true);
        const trunks=[]; const m=new T.Matrix4(), pos=new T.Vector3();
        root.traverse(o=>{if(o.isInstancedMesh && o.userData.snowObstacle==='tree') for(let i=0;i<o.count;i++) {o.getMatrixAt(i,m);pos.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);trunks.push({x:pos.x,z:pos.z});}});
        const expected=[...[-1,0].flatMap(i=>[-1,0].flatMap(j=>sceneryChunk(w,i,j))).filter(o=>o.source==='village'),...sceneryChunk(w,1,1).filter(o=>o.source==='woodland')].filter(o=>o.kind==='tree');
        result.push({low,expected:expected.length,missing:expected.filter(o=>!trunks.some(t=>Math.hypot(o.x-t.x,o.z-t.z)<.001)).map(o=>o.id)});
      }
      window.result=result;
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__solid-scenes');
    await page.waitForFunction(() => Array.isArray((window as any).result));
    const result = await page.evaluate(() => (window as any).result);
    for (const quality of result) {
      expect(quality.expected).toBeGreaterThan(20);
      expect(quality.missing, `missing rendered trunks, low=${quality.low}`).toEqual([]);
    }
  } finally {
    await server.close();
  }
});
