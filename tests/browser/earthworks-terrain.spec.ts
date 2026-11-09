// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';
test('pad progress updates local ground and map while distant chunks survive', async ({ page }) => {
  test.setTimeout(240000);
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/*'] } },
  });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/__earthworks', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}#map{position:absolute;top:12px;left:12px;width:340px;height:340px;background:#243e31}</style><link rel="stylesheet" href="/src/client/style.css"><div id="view"></div><div id="map"></div><script type="module">
   globalThis.__ACLONE_BASE__='/';localStorage.setItem('aclone.quality','low');
   import {createWorld,addPlayer} from '/src/shared/simulation.ts';
   import {GameScene} from '/src/client/scene.ts';import {ParishMap} from '/src/client/parish-map.ts';
   import {terrainHeight} from '/src/shared/terrain.ts';import {defaultCreator} from '/src/shared/creator.ts';
   import {expandPuddlewickIsland} from '/src/server/puddlewick-island.ts';
   import {earthworkSiteReason} from '/src/shared/earthworks-site.ts';
   const w=createWorld('puddlewick','Earthworks hillside','owner');expandPuddlewickIsland(w);
   w.settings.time=43200;w.settings.dayLength=0;w.creator={...defaultCreator(),weather:'clear'};
   const x=832,z=-5056;const h=terrainHeight(w,x,z);
   const p=addPlayer(w,'owner','Surveyor');Object.assign(p,{x:x-30,z:z-38,y:terrainHeight(w,x-30,z-38),vehicle:5,online:true,heading:0.6});
   const work={id:'browser-pad',owner:'owner',created:0,x,z,width:40,depth:40,rotation:0,target:h+2,shoulder:20,shoulderGrade:50,progress:0,finish:'bare'};
   const game=new GameScene(document.getElementById('view'));game.setWorld(w,p.id);
   const map=new ParishMap(document.getElementById('map'),w,p);map.panTo(x,z);
   window.fixture={w,p,work,game,map,terrainHeight,earthworkSiteReason};
   window.advance=(progress)=>{w.earthworks=[{...work,progress}];game.setWorld(w,p.id);map.update(w,p)};
  </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__earthworks');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 120000,
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game, work } = (window as any).fixture;
          return game.ground.meshes.some(
            (m: any) => m.userData.cx === work.x && m.userData.cz === work.z,
          );
        }),
      )
      .toBe(true);
    await page.evaluate(() => {
      const { game, p } = (window as any).fixture;
      while (game.ground.update(p.x, p.z, 100)) {}
    });
    const before = await page.evaluate(() => {
      const f = (window as any).fixture;
      f.old = new Map(
        f.game.ground.meshes.map((m: any) => [m.userData.cx + ':' + m.userData.cz, m.uuid]),
      );
      return {
        height: f.terrainHeight(f.w, f.work.x, f.work.z),
        job: document.querySelector('.map-terrain')?.getAttribute('data-rendered-job'),
      };
    });
    await page.evaluate(() => (window as any).advance(0.5));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game, work, old } = (window as any).fixture;
          const m = game.ground.meshes.find(
            (m: any) => m.userData.cx === work.x && m.userData.cz === work.z,
          );
          return m?.uuid !== old.get(work.x + ':' + work.z);
        }),
      )
      .toBe(true);
    const half = await page.evaluate(() => {
      const { game, work, old, w, terrainHeight } = (window as any).fixture;
      const far = game.ground.meshes.filter(
        (m: any) =>
          Math.hypot(m.userData.cx - work.x, m.userData.cz - work.z) > 300 &&
          old.has(m.userData.cx + ':' + m.userData.cz),
      );
      return {
        height: terrainHeight(w, work.x, work.z),
        far: far.length,
        retained: far.every((m: any) => m.uuid === old.get(m.userData.cx + ':' + m.userData.cz)),
      };
    });
    expect(half.height).toBeCloseTo(before.height + 1, 6);
    expect(half.far).toBeGreaterThan(0);
    expect(half.retained).toBe(true);
    mkdirSync('output/earthworks/browser', { recursive: true });
    await page.screenshot({ path: 'output/earthworks/browser/half-pad.png' });
    await page.evaluate(() => (window as any).advance(1));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game, work } = (window as any).fixture;
          const m = game.ground.meshes.find(
            (m: any) => m.userData.cx === work.x && m.userData.cz === work.z,
          );
          if (!m) return false;
          const pos = m.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++)
            if (
              Math.abs(pos.getX(i)) < 10 &&
              Math.abs(pos.getZ(i)) < 10 &&
              Math.abs(pos.getY(i) - work.target) > 0.0001
            )
              return false;
          return true;
        }),
      )
      .toBe(true);
    await expect
      .poll(() => page.locator('.map-terrain').getAttribute('data-rendered-job'))
      .not.toBe(before.job);
    await page.screenshot({ path: 'output/earthworks/browser/complete-pad.png' });
    const wet = await page.evaluate(() => {
      const f = (window as any).fixture;
      const r = f.w.northernIsland.rivers[0].points[3];
      return f.earthworkSiteReason(f.w, { ...f.work, x: r.x, z: r.z, target: r.level });
    });
    expect(wet).toBeTruthy();
    await page.evaluate(() => {
      const f = (window as any).fixture;
      f.w.earthworks = [];
      f.game.setWorld(f.w, f.p.id);
      f.map.update(f.w, f.p);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const f = (window as any).fixture;
          const mesh = f.game.ground.meshes.find(
            (m: any) => m.userData.cx === f.work.x && m.userData.cz === f.work.z,
          );
          if (!mesh) return false;
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++)
            if (
              Math.abs(
                pos.getY(i) - f.terrainHeight(f.w, pos.getX(i) + f.work.x, pos.getZ(i) + f.work.z),
              ) > 0.0001
            )
              return false;
          return true;
        }),
      )
      .toBe(true);
    // A new snapshot arrives while an unrelated scene rebuild is still queued.
    await page.evaluate(() => {
      const f = (window as any).fixture;
      f.w = {
        ...f.w,
        roads: [...(f.w.roads ?? []), { a: { x: 200, z: 200 }, b: { x: 210, z: 200 }, width: 4 }],
      };
      f.game.setWorld(f.w, f.p.id);
      f.w = { ...f.w, earthworks: [{ ...f.work, progress: 1 }] };
      f.game.setWorld(f.w, f.p.id);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const f = (window as any).fixture;
          if (f.game.worldBuild) return false;
          const mesh = f.game.ground.meshes.find(
            (m: any) => m.userData.cx === f.work.x && m.userData.cz === f.work.z,
          );
          if (!mesh) return false;
          const pos = mesh.geometry.attributes.position;
          for (let i = 0; i < pos.count; i++)
            if (
              Math.abs(pos.getX(i)) < 10 &&
              Math.abs(pos.getZ(i)) < 10 &&
              Math.abs(pos.getY(i) - f.work.target) > 0.0001
            )
              return false;
          return true;
        }),
      )
      .toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});

test('grading removes rendered northern boulders while preserving distant scenery', async ({
  page,
}) => {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 0, watch: { ignored: ['**/*'] } },
  });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__earthwork-rocks', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}</style><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import * as T from '/node_modules/.vite/deps/three.js';
      import {createWorld} from '/src/shared/simulation.ts';
      import {expandPuddlewickIsland} from '/src/server/puddlewick-island.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      import {sceneryChunk} from '/src/shared/scenery-obstacles.ts';
      import {CountrysideChunks} from '/src/client/countryside.ts';
      import {changedEarthworkBounds} from '/src/shared/earthworks-ground.ts';
      const w=createWorld('puddlewick','Boulder clearing','owner');expandPuddlewickIsland(w);
      const x=2520,z=-5000,h=terrainHeight(w,x,z),chunks=new CountrysideChunks();chunks.reset(w,false);
      const rocks=sceneryChunk(w,9,-20).filter(o=>o.kind==='boulder'&&Math.abs(o.x-x)<32&&Math.abs(o.z-z)<32);
      const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,2000),renderer=new T.WebGLRenderer();
      renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);scene.background=new T.Color('#b5c6ca');
      scene.add(chunks.group,new T.HemisphereLight('#ffffff','#666644',3));camera.position.set(x,h+65,z+55);camera.lookAt(x,h,z);
      const pad={id:'rocks',owner:'owner',created:0,x,z,width:24,depth:24,rotation:0,target:h+1,shoulder:24,shoulderGrade:50,progress:1,finish:'bare'};
      window.fixture={w,chunks,rocks,pad};
      window.advance=()=>{w.earthworks=[pad];chunks.refreshEarthworks(w,changedEarthworkBounds(undefined,w.earthworks));};
      function frame(){chunks.update(x,z,100);renderer.render(scene,camera);requestAnimationFrame(frame)}frame();
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__earthwork-rocks');
    const read = () =>
      page.evaluate(() => {
        const f = (window as any).fixture;
        if (!f) return undefined;
        const positions: { x: number; z: number }[] = [],
          ids: Record<string, string> = {};
        for (const c of f.chunks.group.children) {
          ids[c.name] = c.uuid;
          c.traverse((o: any) => {
            if (o.isInstancedMesh) {
              const a = o.instanceMatrix.array;
              for (let i = 0; i < o.count; i++)
                positions.push({ x: a[i * 16 + 12], z: a[i * 16 + 14] });
            }
          });
        }
        return {
          ids,
          count: f.rocks.length,
          present: f.rocks.map((p: any) =>
            positions.some((at) => Math.hypot(at.x - p.x, at.z - p.z) < 0.01),
          ),
        };
      });
    await expect
      .poll(async () => {
        const s = await read();
        return s && Object.keys(s.ids).length >= 9 && s.present.every(Boolean);
      })
      .toBe(true);
    const before = (await read())!;
    expect(before.count).toBeGreaterThan(0);
    await page.evaluate(() => (window as any).advance());
    await expect.poll(async () => (await read())?.present.some(Boolean)).toBe(false);
    const after = (await read())!;
    const far = Object.keys(before.ids).filter((n) => !['Countryside 9,-20'].includes(n));
    expect(far.length).toBeGreaterThan(0);
    expect(far.every((n) => before.ids[n] === after.ids[n])).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
