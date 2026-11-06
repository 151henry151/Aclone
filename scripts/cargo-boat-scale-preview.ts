// SPDX-License-Identifier: GPL-3.0-or-later
// Compare actual game hulls at one camera scale, beside the same quay and person.
import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/cargo-boat-scale/scenery';
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
    await page.route('**/__cargo-scale', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld,addPlayer,makeBuilding} from '/src/shared/simulation.ts';
      import {defaultCreator} from '/src/shared/creator.ts';
      import {boatLandings} from '/src/shared/boathouse.ts';
      import {travelHeight} from '/src/shared/dock.ts';
      import {vehicleDef} from '/src/shared/vehicle-config.ts';
      import {cargoCrewPosition} from '/src/shared/boats.ts';
      const w=createWorld('cargo-scale','Coastal cargo boat','owner');
      Object.assign(w.settings,{mapSize:1000,seaLevel:0,dayLength:0,time:13*3600,tidalRange:0,oceanWaves:0});
      w.terrainMapSize=1000;w.roads=[];w.towns=[];w.zones=[];w.script='';
      w.landscape={paths:[],surfaces:[],barriers:[],scatter:[],heightmap:Array.from({length:1089},(_,i)=>Math.floor(i/33)<16?2:Math.floor(i/33)===16?1:-10)};
      w.creator={...defaultCreator(),roads:false,scenery:false,weather:'clear'};
      w.climate={snow:0,snowDepth:0,wetness:0};
      const quay=makeBuilding('quay','quay',-300,0);quay.rotation=Math.PI;w.buildings=[quay];
      const observer=addPlayer(w,'owner','Dock worker');Object.assign(observer,{x:-300,z:4,y:travelHeight(w,-300,4),vehicle:5,online:true,engine:false,heading:Math.PI});
      const captain=addPlayer(w,'captain','Captain');Object.assign(captain,{vehicle:35,fleet:[0,5,35],boatHold:{stone:1000},online:true,engine:false,y:0});
      const crew=addPlayer(w,'crew','Deckhand');Object.assign(crew,{vehicle:5,online:true,hitch:captain.id});
      const game=new GameScene(document.getElementById('view'));game.setWorld(w,observer.id);
      window.fixture={w,observer,captain,crew,cargoCrewPosition,game,boatLandings,vehicleDef};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__cargo-scale');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 120000,
    });
    for (const stage of ['before', 'after']) {
      const dimensions = await page.evaluate(async (stage) => {
        const {
          w,
          observer,
          captain,
          crew,
          cargoCrewPosition,
          game: g,
          boatLandings,
          vehicleDef,
        } = (window as any).fixture;
        g.renderer.setAnimationLoop(null);
        w.vehicleTuning =
          stage === 'before'
            ? { 35: { length: 20, beam: 5.6, draft: 1.25, freeboard: 1.2, collisionRadius: 2.8 } }
            : {};
        const d = boatLandings(w, 35).find((d: any) => d.id === 'quay');
        Object.assign(captain, d.berth, { heading: d.heading });
        Object.assign(crew, cargoCrewPosition(w, captain));
        w.revision++;
        g.setWorld(w, observer.id);
        for (let i = 0; i < 3000; i++) {
          const a = g.ground.update(observer.x, observer.z, 12, g.groundView()),
            b = g.woods.update(observer.x, observer.z, 12),
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
        g.camera.position.set(-343, 39, 88);
        g.camera.lookAt(-300, 1, 22);
        g.sky.position.copy(g.camera.position);
        g.renderer.render(g.scene, g.camera);
        const v = vehicleDef(w, 35);
        return { length: v.length, beam: v.beam, freeboard: v.freeboard, draft: v.draft };
      }, stage);
      expect(dimensions.length).toBe(stage === 'before' ? 20 : 60);
      expect(dimensions.beam).toBe(stage === 'before' ? 5.6 : 16.8);
      await page.screenshot({ path: `${output}/${stage}-${quality}.png` });
    }
    expect(errors).toEqual([]);
    console.log(
      `${quality}: actual hulls, fixed camera, unchanged person and quay; no browser errors`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
