// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('streamed scenery stays hidden until complete and cancels cleanly when changing worlds', async ({
  page,
}) => {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' } });
  await server.listen();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.route('**/__stream-test', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<script type="module">
  globalThis.__ACLONE_BASE__='/';
  import {createWorld} from '/src/shared/simulation.ts';
  import {GroundTiles} from '/src/client/ground.ts';
  import {CountrysideChunks} from '/src/client/countryside.ts';
  const w=createWorld('puddlewick','Test','server');
  w.settings.mapSize=2500;
  w.coastalBluffs=[{id:'natural-test',x:576,z:576,angle:0,width:100,inland:140,height:35,seed:3}];
  const ground=new GroundTiles(),woods=new CountrysideChunks();
  window.fixture={w,ground,woods};window.ready=true;
  </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__stream-test');
    await page.waitForFunction(() => (window as any).ready);
    const result = await page.evaluate(() => {
      const { w, ground, woods } = (window as any).fixture;
      const now = performance.now.bind(performance);
      let ticks = 0;
      // Force a single small batch per update, independent of the CI machine's speed.
      performance.now = () => (ticks += 10);
      try {
        ground.reset(w);
        woods.reset(w, true);
        const groundPending = ground.update(576, 576),
          woodsPending = woods.update(576, 576);
        const partial = [ground.group.children.length, woods.group.children.length];
        let groundCalls = 1,
          woodsCalls = 1;
        while (!ground.group.children.length && groundCalls++ < 5000) ground.update(576, 576);
        while (!woods.group.children.length && woodsCalls++ < 5000) woods.update(576, 576);
        const tile = ground.group.children[0],
          grove = woods.group.children[0];
        const complete = !!tile.geometry.attributes.snowLift && !!grove.userData.snowDetails;
        // Begin more work, then cancel it. No stale generator may repopulate either group.
        ground.update(1300, 576);
        const oldTileRetained = ground.group.children.includes(tile);
        woods.update(576, 576);
        ground.clear();
        woods.clear();
        ground.update(576, 576);
        woods.update(576, 576);
        const cleared = [ground.group.children.length, woods.group.children.length];
        ground.reset(w);
        ground.update(576, 576);
        const newPending = ground.group.children.length === 0;
        ground.clear();
        return {
          groundPending,
          woodsPending,
          partial,
          complete,
          groundCalls,
          woodsCalls,
          cleared,
          newPending,
          oldTileRetained,
        };
      } finally {
        performance.now = now;
      }
    });
    expect(result.groundPending).toBe(true);
    expect(result.woodsPending).toBe(true);
    expect(result.partial).toEqual([0, 0]);
    expect(result.complete).toBe(true);
    expect(result.groundCalls).toBeGreaterThan(10);
    expect(result.woodsCalls).toBeGreaterThan(2);
    expect(result.cleared).toEqual([0, 0]);
    expect(result.newPending).toBe(true);
    expect(result.oldTileRetained).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
