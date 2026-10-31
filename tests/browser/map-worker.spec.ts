// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

test('terrain runs off-thread, tides retain icons, and ocean waypoints reach the travel boundary', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/__map-worker', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/client/style.css"><style>body{padding:30px}#map{width:1100px;margin:auto}</style><h1>Parish map</h1><div id="map"></div><script type="module">
    import {ParishMap} from '/src/client/parish-map.ts';
    import {Waypoints} from '/src/client/waypoint.ts';
    import {createWorld,addPlayer} from '/src/shared/simulation.ts';
    import {sampleMapTerrain,chartWorld} from '/src/client/map-terrain-job.ts';
    const w=createWorld('puddlewick','Puddlewick','owner'); w.settings.mapSize=20000;w.terrainMapSize=12500;
    const p=addPlayer(w,'owner','Pilot'); const nav=new Waypoints(localStorage);nav.selectWorld(w.id,10000);
    const map=new ParishMap(document.getElementById('map'),w,p,{get:()=>nav.point,set:p=>nav.set(p)});
    window.fixture={map,w,p,nav,sampleMapTerrain,chartWorld};
    </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__map-worker');
    await expect(page.locator('.map-contours')).toHaveCount(1);
    await expect(page.locator('.map-load-status')).toBeHidden();
    const stats = await page.evaluate(async () => {
      const { map, w, p, sampleMapTerrain, chartWorld } = (window as any).fixture;
      const job = {
        id: 0,
        world: chartWorld(w),
        width: map.width,
        height: map.height,
        x: map.bounds.x,
        z: map.bounds.z,
        offsetX: map.offsetX,
        offsetY: map.offsetY,
        scale: map.scale,
        contours: true,
        tide: 0,
      };
      const start = performance.now();
      sampleMapTerrain(job);
      const oldTerrainMs = performance.now() - start;
      const before = performance.now();
      map.draw();
      const newDrawMs = performance.now() - before;
      const workerBusy = map.terrainBusy;
      const icon = map.sheet.querySelector('.map-icon');
      // Simulate a tide refresh without changing any structural map data.
      map.tide = NaN;
      map.update(w, p);
      const sameIcon = icon === map.sheet.querySelector('.map-icon');
      const marker = map.players.firstChild;
      map.update(w, p);
      const sameMarker = marker === map.players.firstChild;
      await new Promise((resolve) => setTimeout(resolve, 0));
      return { oldTerrainMs, newDrawMs, workerBusy, sameIcon, sameMarker };
    });
    expect(stats.workerBusy).toBe(true);
    expect(stats.sameIcon).toBe(true);
    expect(stats.sameMarker).toBe(true);
    await expect(page.locator('.map-load-status')).toBeHidden();
    // A fast burst of views keeps at most one pending job. Only the last may paint.
    const last = await page.evaluate(() => {
      const { map } = (window as any).fixture;
      for (let i = 0; i < 12; i++) {
        map.zoom = 0.2 + i * 0.01;
        map.bounds = map.frame({ x: 0, z: 2000 });
        map.draw();
      }
      const id = map.terrainSerial;
      map.terrainLayer.dataset.expected = String(id);
      return id;
    });
    await expect(page.locator('.map-load-status')).toBeHidden();
    expect(await page.locator('.map-terrain').getAttribute('data-rendered-job')).toBe(String(last));
    await page.evaluate(() => {
      const { map } = (window as any).fixture;
      map.zoom = map.floor();
      map.bounds = map.frame({ x: 0, z: 0 });
      map.draw();
      map.updatePlayers();
      map.panTo(0, 0);
    });
    await expect(page.locator('.map-load-status')).toBeHidden();
    await expect(page.locator('.map-world-boundary')).toHaveCount(1);
    const clickWorld = async (x: number, z: number) => {
      const pos = await page.evaluate(
        ({ x, z }) => {
          const { map } = (window as any).fixture;
          const r = map.sheet.getBoundingClientRect();
          return { x: r.left + map.x(x), y: r.top + map.y(z) };
        },
        { x, z },
      );
      await page.mouse.click(pos.x, pos.y);
      return page.evaluate(() => (window as any).fixture.nav.point);
    };
    const far = await clickWorld(-9000, 9000);
    expect(Math.abs(far.x + 9000)).toBeLessThan(50);
    expect(Math.abs(far.z - 9000)).toBeLessThan(50);
    const edge = await clickWorld(12000, 4000);
    expect(edge.x).toBe(10000);
    expect(Math.abs(edge.z - 4000)).toBeLessThan(50);
    expect(
      await page.evaluate(() => JSON.parse(localStorage.getItem('aclone.waypoint.puddlewick')!).x),
    ).toBe(10000);
    mkdirSync('output/map-feedback', { recursive: true });
    await page.screenshot({ path: 'output/map-feedback/ocean-boundary.png' });
    writeFileSync('output/map-feedback/timings.json', JSON.stringify(stats, null, 2));
    await page.evaluate(() => (window as any).fixture.map.dispose());
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
