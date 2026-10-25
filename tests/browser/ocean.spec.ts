// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('the actual world renderer keeps water under offshore boats after freezing scenery', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__ocean', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
        globalThis.__ACLONE_BASE__='/';
        import * as T from '/node_modules/three/build/three.module.js';
        import {GameScene} from '/src/client/scene.ts';
        import {createWorld} from '/src/shared/simulation.ts';
        import {placeSea} from '/src/client/ground.ts';
        import {waitForTextures} from '/src/client/materials.ts';
        const w=createWorld('puddlewick','Puddlewick','server');
        w.settings.mapSize=18500;w.terrainMapSize=12500;w.buildings=[];
        w.creator={scenery:false};
        const game=new GameScene(document.getElementById('view'));
        game.renderer.setAnimationLoop(null);
        game.buildWorld(w);
        game.space.visible=false;game.land.visible=true;game.scene.fog=null;
        game.scene.background=new T.Color('#adc6cb');
        game.scene.add(new T.HemisphereLight('#ffffff','#68889a',3));
        const boat=game.vehicle(30);boat.position.set(0,w.settings.seaLevel,6500);game.actors.add(boat);game.actors.visible=true;
        await waitForTextures();
        window.renderOcean=(phase)=>{
          placeSea(game.water,0,6500);
          boat.userData.fishingBoat.animate(phase==='tow',phase==='loaded'?0:4,8,phase==='haul'?3.3:Infinity,phase==='loaded'?4:1);
          game.camera.fov=40;game.camera.updateProjectionMatrix();
          game.camera.position.set(-24,18,6470);game.camera.lookAt(0,2,6496);
          game.renderer.render(game.scene,game.camera);
          const at=new T.Vector3().setFromMatrixPosition(game.water.matrixWorld);
          return {x:at.x,z:at.z,local:game.water.position.z};
        };window.ready=true;
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__ocean');
    await page.waitForFunction(() => (window as any).ready);
    for (const phase of ['tow', 'haul', 'loaded']) {
      const at = await page.evaluate((phase) => (window as any).renderOcean(phase), phase);
      expect(Math.abs(at.z - 6500)).toBeLessThan(30);
      expect(at.z).toBe(at.local);
      await page.screenshot({ path: `test-results/offshore-${phase}.png` });
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
