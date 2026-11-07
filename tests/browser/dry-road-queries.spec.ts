// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('dry travel skips road-network work for tyre tracks while snow retains it', async ({
  page,
}) => {
  test.setTimeout(180000);
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.addInitScript(() => {
      localStorage.setItem('aclone.quality', 'low');
      localStorage.setItem('aclone.sound', 'off');
    });
    // Observe the real shared query, without replacing its geometry or result.
    await page.route('**/src/shared/town.ts', async (route) => {
      const response = await route.fetch();
      const text = await response.text();
      const instrumented = text.replace(
        /(function townRoads\(w\)\s*\{)/,
        '$1 globalThis.__roadQueries = (globalThis.__roadQueries ?? 0) + 1;',
      );
      expect(instrumented).not.toBe(text);
      await route.fulfill({ response, body: instrumented });
    });
    await page.route('**/__dry-roads', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
      <style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {createWorld,addPlayer} from '/src/shared/simulation.ts';
      import {roadKey} from '/src/shared/town.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      const w=createWorld('dry-road-test','Dry roads','owner');
      w.settings.time=43200;w.settings.dayLength=0;
      w.roads=Array.from({length:2003},(_,i)=>({a:{x:300+i%80*6,z:300+Math.floor(i/80)*6},b:{x:306+i%80*6,z:300+Math.floor(i/80)*6},width:5}));
      w.retiredRoads=w.roads.slice(0,83).map(roadKey);
      w.climate={snow:0,snowDepth:0,wetness:0};
      const p=addPlayer(w,'owner','Surveyor');p.online=true;p.vehicle=5;p.x=0;p.z=17;p.y=terrainHeight(w,p.x,p.z);
      const game=new GameScene(document.getElementById('view'));game.setWorld(w,p.id);
      window.fixture={w,p,game};
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__dry-roads');
    await page.waitForFunction(() => (window as any).fixture?.game.ready);
    for (const vehicle of [5, 0]) {
      await page.evaluate((vehicle) => {
        const { w, p, game } = (window as any).fixture;
        p.vehicle = vehicle;
        p.speed = vehicle === 5 ? 2 : 10;
        game.setWorld(w, p.id);
      }, vehicle);
      await page.waitForTimeout(250);
      await page.evaluate(() => ((window as any).__roadQueries = 0));
      await page.waitForTimeout(300);
      expect(
        await page.evaluate(() => (window as any).__roadQueries),
        'dry frames need no road list for tracks',
      ).toBe(0);
    }
    await page.evaluate(() => {
      const { w, p, game } = (window as any).fixture;
      w.climate = { snow: 1, snowDepth: 0.2, wetness: 0 };
      game.setWorld(w, p.id);
      (window as any).__roadQueries = 0;
    });
    await expect.poll(() => page.evaluate(() => (window as any).__roadQueries)).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
