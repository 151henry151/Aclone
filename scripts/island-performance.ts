// SPDX-License-Identifier: GPL-3.0-or-later
/** Repeatable isolated renderer/streaming comparison. Never connects to production. */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createWorld } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
const out = process.env.PROFILE_OUT ?? 'output/island-performance';
mkdirSync(out, { recursive: true });
const original = createWorld('puddlewick', 'Puddlewick', 'server');
original.settings.mapSize = 18500;
original.terrainMapSize = 12500;
original.townLayout = 2;
const expanded = structuredClone(original),
  started = performance.now();
expandPuddlewickIsland(expanded);
const generationMs = performance.now() - started;
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
    await page.addInitScript(() => {
      (window as any).__name = (value: unknown) => value;
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    });
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
  const p=addPlayer(w,'profile','Surveyor');p.online=true;p.engine=false;p.x=0;p.z=0;p.y=terrainHeight(w,0,0);
  const stats={renders:[],cpu:[],longTasks:[]};new PerformanceObserver(list=>stats.longTasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
  const game=new GameScene(document.getElementById('view'));const draw=game.renderer.render.bind(game.renderer);
  game.renderer.render=(...args)=>{const at=performance.now();draw(...args);stats.renders.push(at);stats.cpu.push(performance.now()-at);};
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
      await page.evaluate((p) => (window as any).locate(p), location);
      await page.waitForTimeout(Number(process.env.PROFILE_WARM_SECONDS ?? 10) * 1000);
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
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown',
          gpu: game.renderer.info.memory,
          draws: game.renderer.info.render.calls,
          triangles: game.renderer.info.render.triangles,
          groundTiles: game.ground.group.children.length,
          treeChunks: game.woods.group.children.length,
          inlandMeshes: game.inland.group.children.length,
          streaming: !!game.ground.pending || !!game.woods.pending,
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
        location: location.name,
        coldMs,
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
      writeFileSync(out + '/map.json', JSON.stringify(map, null, 2));
    }
    if (errors.length) throw Error(errors.join('\n'));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
