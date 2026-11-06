import { obstaclePerformance } from './obstacle-performance';
// SPDX-License-Identifier: GPL-3.0-or-later
/** Repeatable isolated renderer/streaming comparison. Never connects to production. */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
const out = process.env.PROFILE_OUT ?? 'output/island-performance';
mkdirSync(out, { recursive: true });
const original = createWorld('puddlewick', 'Puddlewick', 'server');
original.settings.mapSize = 18500;
original.terrainMapSize = 12500;
original.townLayout = 2;
const doorMode = process.env.PROFILE_DOORS;
if (doorMode && !['open', 'closed'].includes(doorMode))
  throw Error('PROFILE_DOORS must be open or closed');
if (doorMode) original.settings.buildingDoorMode = doorMode;
const parkedPopulation = process.env.PROFILE_PARKED === '1';
const quality = process.env.PROFILE_QUALITY ?? 'low';
if (!['low', 'normal'].includes(quality)) throw Error('PROFILE_QUALITY must be low or normal');
const population = Number(process.env.PROFILE_POPULATION ?? 0);
if (!Number.isInteger(population) || population < 0 || population > 200)
  throw Error('PROFILE_POPULATION must be 0–200');
if (population)
  for (let i = 0; i < 24; i++) {
    const b = makeBuilding(
      'profile-home-' + i,
      'home',
      300 + (i % 8) * 35,
      -300 + Math.floor(i / 8) * 35,
    );
    b.owner = 'resident-' + i;
    original.buildings.push(b);
  }
const expanded = structuredClone(original),
  started = performance.now();
expandPuddlewickIsland(expanded);
const generationMs = performance.now() - started;
const movement = obstaclePerformance(expanded, population || 32);
writeFileSync(out + '/movement.json', JSON.stringify(movement, null, 2));
console.log('Movement budget', JSON.stringify(movement));
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: { ignored: ['**/*'] } },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist'],
});
const results: any[] = [];
try {
  for (const [name, world] of [
    ['original', original],
    ['expanded', expanded],
  ] as const) {
    if (process.env.PROFILE_WORLD && name !== process.env.PROFILE_WORLD) continue;
    const page = await browser.newPage({
      viewport: process.env.PROFILE_PHONE
        ? { width: 390, height: 844 }
        : { width: 1280, height: 800 },
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript((quality) => {
      (window as any).__name = (value: unknown) => value;
      localStorage.setItem('aclone.quality', quality);
      localStorage.setItem('aclone.sound', 'off');
    }, quality);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    if (process.env.PROFILE_THROTTLE)
      await cdp.send('Emulation.setCPUThrottlingRate', {
        rate: Number(process.env.PROFILE_THROTTLE),
      });
    await page.route('**/__profile', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}#map{position:absolute;inset:10px;background:#243e31;display:none}</style><link rel="stylesheet" href="/src/client/style.css"><div id="view"></div><div id="map"></div><script type="module">
  globalThis.__ACLONE_BASE__='/';
  import {GameScene} from '/src/client/scene.ts';import {ParishMap} from '/src/client/parish-map.ts';
  import {addPlayer} from '/src/shared/simulation.ts';import {terrainHeight} from '/src/shared/terrain.ts';import {defaultCreator} from '/src/shared/creator.ts';
  const w=${JSON.stringify(world)};w.settings.time=40000;w.settings.dayLength=0;w.climate={snow:0,wetness:0};w.creator=defaultCreator();w.creator.weather='clear';
  const p=addPlayer(w,'profile','Surveyor');p.online=true;p.engine=false;p.x=0;p.z=0;p.y=terrainHeight(w,0,0);if(${population})p.heading=Math.atan2(76,48);
  for(let i=0;i<${population};i++){const q=addPlayer(w,'resident-'+i,'Resident '+i);Object.assign(q,{online:true,vehicle:i%3?0:5,engine:false,x:45+(i%8)*9,z:30+Math.floor(i/8)*12});q.y=terrainHeight(w,q.x,q.z);if(${parkedPopulation}&&q.vehicle!==5){w.parkedVehicles??={};w.parkedVehicles[q.id+':'+q.vehicle]={owner:q.id,ownerName:q.name,slot:q.vehicle,x:q.x,z:q.z,y:q.y,heading:q.heading,fuel:q.fuel,condition:100,parkedAt:w.time};delete w.players[q.id];}}
  const stats={renders:[],cpu:[],longTasks:[]};new PerformanceObserver(list=>stats.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
  const game=new GameScene(document.getElementById('view'));const draw=game.renderer.render.bind(game.renderer);
  game.renderer.render=(...args)=>{const visible=game.renderer.getRenderTarget()===null;const at=performance.now();draw(...args);if(visible){stats.renders.push(at);stats.cpu.push(performance.now()-at);}};
  const begin=performance.now();game.setWorld(w,p.id);window.fixture={w,p,game,stats,begin,terrainHeight};
  window.locate=(point)=>{Object.assign(p,point);p.y=terrainHeight(w,p.x,p.z);w.creator.weather=point.storm?'rainstorm':'clear';game.setWorld(w,p.id);};
  window.mapOpen=()=>{const h=document.getElementById('map');h.style.display='block';const map=new ParishMap(h,w,p);map.zoom=.016/map.unitScale();map.bounds=map.frame({x:0,z:-14500});map.draw();map.panTo(0,-14500);window.map=map;};
  </script>`,
      }),
    );
    const load = performance.now();
    await page.goto(server.resolvedUrls!.local[0] + '__profile');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 300000,
    });
    const coldMs = performance.now() - load;
    const n = expanded.northernIsland!,
      r = n.rivers[0].points[Math.floor(n.rivers[0].points.length * 0.57)],
      f = n.regions.reduce((a, b) => (a.forest > b.forest ? a : b));
    const cases =
      name === 'original'
        ? [{ name: 'town', x: 0, z: 0 }]
        : [
            { name: 'town', x: 0, z: 0 },
            { name: 'river', x: r.x + 20, z: r.z },
            { name: 'forest', x: f.x, z: f.z },
            { name: 'summit', x: n.mountain.x, z: n.mountain.z },
            { name: 'storm-coast', x: 0, z: 4500, storm: true },
            { name: 'return-town', x: 0, z: 0 },
          ];
    for (const location of cases) {
      if (
        process.env.PROFILE_CASES &&
        !process.env.PROFILE_CASES.split(',').includes(location.name)
      )
        continue;
      const from = await page.evaluate((p) => {
        const f = (window as any).fixture;
        const from = { x: f.p.x, z: f.p.z };
        f.stats.renders = [];
        f.stats.cpu = [];
        f.stats.longTasks = [];
        (window as any).locate(p);
        return from;
      }, location);
      await page.waitForTimeout(Number(process.env.PROFILE_WARM_SECONDS ?? 10) * 1000);
      const transition = await page.evaluate(() => {
        const f = (window as any).fixture;
        const spans = f.stats.renders
          .slice(1)
          .map((t: number, i: number) => t - f.stats.renders[i])
          .sort((a: number, b: number) => a - b);
        return {
          p95: spans[Math.floor((spans.length - 1) * 0.95)],
          max: spans.at(-1),
          over100ms: spans.filter((t: number) => t > 100).length,
          longTasks: f.stats.longTasks,
          streaming: !!f.game.ground.pending || !!f.game.woods.pending,
        };
      });
      await page.evaluate(() => {
        const f = (window as any).fixture;
        f.drawnParked = new Set<string>();
        for (const model of f.game.parkedVehicles.group.children)
          model.traverse((o: any) => {
            if (o.isMesh) {
              const before = o.onBeforeRender;
              o.onBeforeRender = function (...args: any[]) {
                f.drawnParked.add(model.userData.parkedVehicle);
                before.apply(this, args);
              };
            }
          });
      });
      await cdp.send('HeapProfiler.collectGarbage');
      await page.evaluate(() => {
        const s = (window as any).fixture.stats;
        s.renders = [];
        s.cpu = [];
        s.longTasks = [];
      });
      if (process.env.PROFILE_CPU) {
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
      }
      const metricsStart = await cdp.send('Performance.getMetrics');
      const duration = Number(process.env.PROFILE_SECONDS ?? 15) * 1000;
      await page.evaluate(
        async ({ duration, moving }) => {
          const f = (window as any).fixture,
            start = performance.now(),
            x = f.p.x,
            z = f.p.z;
          let last = 0;
          await new Promise<void>((resolve) => {
            function frame() {
              const t = performance.now() - start;
              if (t >= duration) {
                resolve();
                return;
              }
              if (moving && t - last >= 100) {
                last = t;
                f.p.x = x + t * 0.008;
                f.p.z = z + t * 0.004;
                f.p.y = f.terrainHeight(f.w, f.p.x, f.p.z);
                f.w.time += 0.1;
                f.game.setWorld(f.w, f.p.id);
              }
              requestAnimationFrame(frame);
            }
            frame();
          });
        },
        { duration, moving: !location.name.includes('town') },
      );
      if (process.env.PROFILE_CPU) {
        const profile = await cdp.send('Profiler.stop');
        writeFileSync(
          out + '/' + name + '-' + location.name + '.cpuprofile',
          JSON.stringify(profile.profile),
        );
      }
      const metricsEnd = await cdp.send('Performance.getMetrics');
      const data = await page.evaluate(() => {
        const { game, stats } = (window as any).fixture;
        const gl = game.renderer.getContext(),
          debug = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          ...stats,
          position: { x: (window as any).fixture.p.x, z: (window as any).fixture.p.z },
          population: Object.keys((window as any).fixture.w.players).length,
          parkedVehicles: game.parkedVehicles.group.children.length,
          drawnParkedVehicles: (window as any).fixture.drawnParked.size,
          buildings: (window as any).fixture.w.buildings.length,
          groundKeys: game.ground.group.children
            .map((t: any) => [t.userData.cx, t.userData.cz].join(':'))
            .sort(),
          pixelRatio: game.renderer.getPixelRatio(),
          quality: game.qualityLabel,
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown',
          gpu: game.renderer.info.memory,
          draws: game.renderer.info.render.calls,
          triangles: game.renderer.info.render.triangles,
          groundTiles: game.ground.group.children.length,
          treeChunks: game.woods.group.children.length,
          inlandMeshes: game.inland.group.children.length,
          streaming: !!game.ground.pending || !!game.woods.pending,
          openInteriors: game.buildingMeshes
            .flatMap((g: any) => g.userData.interiors ?? [])
            .filter((r: any) => r.group.visible).length,
          furnishedInteriors: game.buildingMeshes.flatMap((g: any) => g.userData.interiors ?? [])
            .length,
        };
      });
      const spans = data.renders
          .slice(1)
          .map((t: number, i: number) => t - data.renders[i])
          .sort((a: number, b: number) => a - b),
        pct = (q: number) => spans[Math.floor((spans.length - 1) * q)];
      const metric = (m: any, key: string) => m.metrics.find((v: any) => v.name === key)?.value;
      const row = {
        world: name,
        doorMode: doorMode ?? 'hours',
        quality,
        parkedPopulation,
        location: location.name,
        coldMs,
        from,
        transition,
        viewport: page.viewportSize(),
        cpuThrottle: Number(process.env.PROFILE_THROTTLE ?? 1),
        renderCpuP95: [...data.cpu].sort((a: number, b: number) => a - b)[
          Math.floor((data.cpu.length - 1) * 0.95)
        ],
        frames: data.renders.length,
        p50: pct(0.5),
        p95: pct(0.95),
        p99: pct(0.99),
        max: spans.at(-1),
        over100ms: spans.filter((v: number) => v > 100).length,
        longTasks: data.longTasks,
        heapMiB: metric(metricsEnd, 'JSHeapUsedSize') / 1048576,
        taskSeconds: metric(metricsEnd, 'TaskDuration') - metric(metricsStart, 'TaskDuration'),
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => !['renders', 'cpu', 'longTasks'].includes(key)),
        ),
      };
      results.push(row);
      console.log(JSON.stringify(row));
      writeFileSync(
        out + '/results.json',
        JSON.stringify(
          {
            generationMs,
            originalBytes: JSON.stringify(original).length,
            expandedBytes: JSON.stringify(expanded).length,
            results,
            errors,
          },
          null,
          2,
        ),
      );
      if (population && location.name === 'town')
        await page.screenshot({ path: out + '/fleet.png' });
      if (doorMode)
        await page.screenshot({ path: out + '/' + location.name + '-' + doorMode + '.png' });
      if (location.name === 'summit') await page.screenshot({ path: out + '/summit.png' });
    }
    if (name === 'expanded' && !process.env.PROFILE_SKIP_MAP) {
      await page.evaluate(() => {
        const s = (window as any).fixture.stats;
        s.longTasks = [];
        s.renders = [];
        (window as any).mapOpen();
      });
      await page.waitForFunction(
        () => document.querySelector('.map-terrain')?.getAttribute('data-rendered-job'),
        undefined,
        { timeout: 120000 },
      );
      const map = await page.evaluate(() => {
        const f = (window as any).fixture,
          m = (window as any).map;
        return {
          longTasks: f.stats.longTasks,
          renders: f.stats.renders.length,
          nodes: document.querySelectorAll('*').length,
          resources: document.querySelectorAll('.map-resource-dot').length,
          pending: !!m.pendingTerrain,
        };
      });
      const interactions = [];
      for (const operation of ['zoom-in', 'pan-right', 'zoom-out']) {
        const start = performance.now();
        await page.evaluate(() => {
          (window as any).fixture.stats.longTasks = [];
        });
        if (operation === 'pan-right')
          await page
            .getByRole('region', {
              name: 'Parish map; drag, scroll or use arrow keys to pan',
              exact: true,
            })
            .press('ArrowRight');
        else
          await page
            .getByRole('button', {
              name: operation === 'zoom-in' ? 'Zoom in' : 'Zoom out',
              exact: true,
            })
            .click();
        await page.waitForFunction(
          () =>
            document.querySelector('.map-terrain')?.getAttribute('data-rendered-job') ===
            String((window as any).map.terrainSerial),
          undefined,
          { timeout: 120000 },
        );
        interactions.push({
          operation,
          ms: performance.now() - start,
          ...(await page.evaluate(() => ({
            zoom: (window as any).map.zoom,
            longTasks: (window as any).fixture.stats.longTasks,
          }))),
        });
      }
      writeFileSync(out + '/map.json', JSON.stringify({ open: map, interactions }, null, 2));
    }
    if (errors.length) throw Error(errors.join('\n'));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
