// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('flight views render empty terrain, a distant town, high flight and the landing approach', async ({
  page,
}) => {
  test.setTimeout(240000);
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.addInitScript(() => {
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    });
    await page.route('**/__flight-view', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld,addPlayer} from '/src/shared/simulation.ts';
      import {defaultCreator} from '/src/shared/creator.ts';
      import {flightState} from '/src/shared/flight.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      import {ensurePuddlewickAirfield} from '/src/server/puddlewick-airfield.ts';
      const w=createWorld('puddlewick','Flight views','server');
      w.settings.mapSize=12500;w.terrainMapSize=12500;w.towns[0].radius=310;
      ensurePuddlewickAirfield(w);
      w.settings.time=43200;w.settings.dayLength=0;w.climate={snow:0,snowDepth:0,wetness:0};
      w.creator={...defaultCreator(),weather:'clear'};
      const p=addPlayer(w,'profile','Pilot');
      Object.assign(p,{vehicle:2,online:true,engine:true,x:1000,z:0,y:terrainHeight(w,1000,0)+120,speed:29.5,heading:-Math.PI/2});
      Object.assign(flightState(p,terrainHeight(w,p.x,p.z)),{grounded:false,vx:0,vz:0,vy:0,bank:0,pitch:0,throttle:.5});
      const game=new GameScene(document.getElementById('view'));game.cameraMode=0;game.setWorld(w,p.id);
      window.fixture={w,p,game,terrainHeight};
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__flight-view');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 120000,
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).fixture.game.scene.fog.far))
      .toBe(1600);
    await page.evaluate(() => {
      const { game } = (window as any).fixture;
      game.ground.clear();
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game } = (window as any).fixture;
          return game.horizon.revision === game.ground.revision && game.ground.meshes.length === 0;
        }),
      )
      .toBe(true);
    await page.screenshot({ path: 'test-results/flight-empty-town.png' });
    const buildingsFade = await page.evaluate(() => {
      const { game } = (window as any).fixture;
      let count = 0,
        missing = 0;
      for (const g of game.buildingMeshes)
        if (g.userData.building)
          g.traverse((o: any) => {
            if (o.isMesh && o.visible)
              for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
                count++;
                if (!m.customProgramCacheKey().includes('scenery-fog')) missing++;
              }
          });
      const batched = game.land.children.filter(
        (o: any) =>
          o.isMesh &&
          !o.isInstancedMesh &&
          o.material?.isMeshStandardMaterial &&
          o.material.customProgramCacheKey().includes('scenery-fog'),
      ).length;
      return { count, missing, batched };
    });
    expect(buildingsFade.count).toBeGreaterThan(0);
    expect(buildingsFade.missing).toBe(0);
    expect(buildingsFade.batched, 'static batches must retain building haze').toBeGreaterThan(0);
    await page.evaluate(() => {
      const { w, game } = (window as any).fixture;
      game.ground.reset(w);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { game } = (window as any).fixture;
          return game.ground.meshes.some(
            (m: any) =>
              m.userData.detailed && Math.hypot(m.userData.cx - 1000, m.userData.cz) < 100,
          );
        }),
      )
      .toBe(true);
    await page.waitForFunction(() => {
      const { game, p } = (window as any).fixture;
      return !game.ground.update(p.x, p.z, 0, game.groundView());
    });
    await page.screenshot({ path: 'test-results/flight-town-loaded.png' });
    await page.evaluate(() => {
      const { w, p, game, terrainHeight } = (window as any).fixture;
      p.y = terrainHeight(w, p.x, p.z) + 800;
      game.setWorld(w, p.id);
    });
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const { game } = (window as any).fixture;
            return (
              game.ground.meshes.length > 100 &&
              game.ground.meshes.every(
                (m: any) => m.userData.detail === false && m.userData.coarseFeatures,
              )
            );
          }),
        { timeout: 60000 },
      )
      .toBe(true);
    await page.screenshot({ path: 'test-results/flight-high.png' });
    await page.evaluate(() => {
      const { w, p, game } = (window as any).fixture;
      const a = w.airfield;
      Object.assign(p, { x: a.x, z: a.z - a.length / 2 - 30, y: a.height + 20, heading: 0 });
      p.flight.vy = -3;
      game.cameraMode = 1;
      game.setWorld(w, p.id);
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { p, game } = (window as any).fixture;
          return game.ground.meshes.some(
            (m: any) =>
              m.userData.detailed &&
              Math.abs(m.userData.cx - p.x) <= 64 &&
              Math.abs(m.userData.cz - p.z) <= 64,
          );
        }),
      )
      .toBe(true);
    await page.waitForFunction(() => {
      const { game, p } = (window as any).fixture;
      return !game.ground.update(p.x, p.z, 0, game.groundView());
    });
    await page.screenshot({ path: 'test-results/flight-approach.png' });
    await page.evaluate(() => {
      const { w, p, game } = (window as any).fixture;
      p.flight.grounded = true;
      p.y = w.airfield.height;
      game.setWorld(w, p.id);
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).fixture.game.scene.fog.far))
      .toBe(45000);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
