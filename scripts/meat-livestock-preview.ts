// SPDX-License-Identifier: GPL-3.0-or-later
// Actual game scenery and instanced herds, in a disposable local fixture.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/livestock-meat/scenery';
mkdirSync(output, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const browser = await chromium.launch({
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist'],
});
try {
  for (const quality of ['normal', 'low']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
      errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((q) => {
      localStorage.setItem('aclone.quality', q);
      localStorage.setItem('aclone.sound', 'off');
    }, quality);
    await page.route('**/__meat-preview', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld,addPlayer,makeBuilding} from '/src/shared/simulation.ts';
      import {defaultCreator} from '/src/shared/creator.ts';
      import {livestockSites} from '/src/client/livestock-scene.ts';
      const w=createWorld('pasture-preview','Pasture to plate','owner');
      Object.assign(w.settings,{mapSize:500,seaLevel:-2,dayLength:0,time:13*3600,tidalRange:0});
      w.terrainMapSize=500;w.roads=[];w.towns=[];w.zones=[];w.script='';
      w.landscape={paths:[],surfaces:[],barriers:[],scatter:[],heightmap:Array(1089).fill(20)};
      w.creator={...defaultCreator(),roads:false,scenery:false,weather:'clear'};
      w.climate={snow:0,snowDepth:0,wetness:0};
      const p=addPlayer(w,'owner','Farmer');Object.assign(p,{x:23,z:11,y:20,vehicle:5,online:true,engine:false,heading:Math.PI});
      const farm=makeBuilding('dairy','dairy',0,0);Object.assign(farm,{owner:p.id,stock:{cows:2,calves:2,feed:100,water:100},pasture:{x:20,z:0,parcels:1},young:[{item:'calves',count:2,born:0,grownDays:10}]});
      const butcher=makeBuilding('butcher','butcher',65,0);Object.assign(butcher,{owner:p.id,architecture:'model-3',stock:{beef:20}});
      w.buildings=[farm,butcher];
      const game=new GameScene(document.getElementById('view'));game.cameraMode=0;game.setWorld(w,p.id);
      window.fixture={w,p,game,livestockSites};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__meat-preview');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 120000,
    });
    const sites: { young: boolean; scale: number }[] = await page.evaluate(() => {
      const { w, p, livestockSites } = (window as any).fixture;
      return livestockSites(w, p).map((s: any) => ({ young: s.young, scale: s.scale }));
    });
    expect(sites.filter((s) => s.young)).toHaveLength(2);
    expect(sites.filter((s) => !s.young)).toHaveLength(2);
    expect(sites.filter((s) => s.young).every((s) => s.scale === 0.55)).toBe(true);
    for (const subject of ['herd', 'butcher']) {
      await page.evaluate(async (subject) => {
        const { w, p, game: g } = (window as any).fixture;
        g.renderer.setAnimationLoop(null);
        p.x = subject === 'herd' ? 23 : 65;
        p.z = 14;
        g.setWorld(w, p.id);
        for (let i = 0; i < 3000; i++) {
          const a = g.ground.update(p.x, p.z, 12, g.groundView()),
            b = g.woods.update(p.x, p.z, 12),
            c = g.horizon.prepare(12);
          if (!a && !b && !c) break;
          await new Promise((r) => setTimeout(r, 0));
          if (i === 2999) throw Error('Scenery did not settle');
        }
        g.lastTime = performance.now() - 34;
        g.renderTime = -Infinity;
        g.frame(true);
        g.renderer.setPixelRatio(1);
        g.camera.fov = 48;
        g.camera.updateProjectionMatrix();
        if (subject === 'herd') {
          g.camera.position.set(38, 27, 21);
          g.camera.lookAt(20, 21, 0);
        } else {
          g.camera.position.set(83, 30, 23);
          g.camera.lookAt(65, 22, 2);
        }
        g.sky.position.copy(g.camera.position);
        g.renderer.render(g.scene, g.camera);
      }, subject);
      await page.screenshot({ path: `${output}/${subject}-${quality}.png` });
    }
    expect(errors).toEqual([]);
    console.log(
      `${quality}: two adults, two smaller young, actual herd and butcher scenery, no browser errors`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
