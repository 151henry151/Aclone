// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
test('marine air draft contains each actual rendered boat and the default bridge clears the fleet', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__bridge-models', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<script>globalThis.__ACLONE_BASE__='/'</script><script type="module">
      import * as T from '/node_modules/three/build/three.module.js';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld} from '/src/shared/simulation.ts';
      import {vehicleDef} from '/src/shared/vehicle-config.ts';
      import {bridgeRules} from '/src/shared/bridge-rules.ts';
      try {
        const world=createWorld('bounds','Boat clearance','owner');
        const rows=[3,29,30,31,32,33,34,35,36].map(slot=>{
          const def=vehicleDef(world,slot), model=GameScene.prototype.vehicle.call({world},slot);
          model.updateMatrixWorld(true);
          const bounds=new T.Box3().setFromObject(model,true);
          return {slot,name:def.name,height:bounds.max.y,airDraft:def.airDraft};
        });
        window.result={rows,clearance:bridgeRules(world.settings).bridgeClearance};
      }catch(error){window.result={error:String(error)}}
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__bridge-models');
    await page.waitForFunction(() => !!(window as any).result);
    const result = await page.evaluate(() => (window as any).result);
    console.log('MARINE_CLEARANCE', JSON.stringify(result));
    expect(result.error).toBeUndefined();
    for (const r of result.rows) {
      expect(r.airDraft, r.name).toBeGreaterThanOrEqual(r.height);
      expect(r.airDraft - r.height, r.name + ' conservative but close to the model').toBeLessThan(
        1,
      );
      expect(result.clearance).toBeGreaterThan(r.airDraft);
    }
  } finally {
    await page.close();
    await server.close();
  }
});
