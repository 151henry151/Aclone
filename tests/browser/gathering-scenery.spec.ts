// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { createWorld } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';

test('gathering grounds render natural, worn and legacy states live in lowland and northern streaming', async ({
  page,
}) => {
  test.setTimeout(300000);
  const w = createWorld('puddlewick', 'Gathering views', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.towns = [];
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
    await page.route('**/__gathering-views', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><style>body{margin:0}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
      globalThis.__ACLONE_BASE__='/';
      import {GameScene} from '/src/client/scene.ts';
      import {addPlayer} from '/src/shared/simulation.ts';
      import {terrainHeight} from '/src/shared/terrain.ts';
      import {worldResources} from '/src/shared/resources.ts';
      import {defaultCreator} from '/src/shared/creator.ts';
      const w=${JSON.stringify(w)}; w.resources={}; w.settings.time=43200; w.settings.dayLength=0; w.time=10000;
      w.climate={snow:0,snowDepth:0,wetness:0}; w.creator={...defaultCreator(),weather:'clear'};
      const nodes=worldResources(w), first=nodes.find(n=>n.item==='logs'&&Math.max(Math.abs(n.x),Math.abs(n.z))<300);
      const p=addPlayer(w,'owner','Explorer'); Object.assign(p,{x:first.x+12,z:first.z+18,y:terrainHeight(w,first.x+12,first.z+18),vehicle:5,online:true,engine:false,lights:false});
      const game=new GameScene(document.getElementById('view')); game.setWorld(w,p.id);
      window.fixture={w,p,game,nodes};
      window.showSite=async(id,far=false)=>{
        game.renderer.setAnimationLoop(null); const n=nodes.find(n=>n.id===id); const dx=far?200:12,dz=far?125:18;
        Object.assign(p,{x:n.x+dx,z:n.z+dz,y:terrainHeight(w,n.x+dx,n.z+dz)});
        game.setWorld(structuredClone(w),p.id);
        for(let i=0;i<6000;i++){const ground=game.ground.update(p.x,p.z,12),woods=game.woods.update(p.x,p.z,12),horizon=game.horizon.prepare(12);if(!ground&&!woods&&!horizon)break;await new Promise(r=>setTimeout(r,0));if(i===5999)throw Error('Gathering terrain failed to settle');}
        game.lastTime=performance.now()-34;game.renderTime=-Infinity;game.frame(true);
        game.camera.position.set(p.x,Math.max(p.y,terrainHeight(w,n.x,n.z))+(far?70:8),p.z);game.camera.lookAt(n.x,terrainHeight(w,n.x,n.z)+2,n.z);game.sky.position.copy(game.camera.position);
        game.renderer.render(game.scene,game.camera);
        let group;game.scene.traverse(o=>{if(o.userData.resource===id)group=o;});
        return group?group.children.map(o=>({surface:o.name.split(' ').at(-1),triangles:o.geometry?.attributes.position.count/3})):null;
      };
      </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__gathering-views');
    await page.waitForFunction(() => (window as any).fixture?.game.ready, undefined, {
      timeout: 120000,
    });
    const sites = await page.evaluate(() => {
      const { nodes } = (window as any).fixture;
      return ['lowland', 'north'].flatMap((region) =>
        ['logs', 'stone', 'gravel', 'dirt'].map((item) => {
          const n = nodes.find(
            (n: any) =>
              n.item === item &&
              (region === 'lowland' ? Math.max(Math.abs(n.x), Math.abs(n.z)) < 300 : n.z < -3000),
          );
          if (!n) throw Error(`Missing ${region} ${item}`);
          return { id: n.id, item, region };
        }),
      );
    });
    const show = (id: string, far = false) =>
      page.evaluate(({ id, far }) => (window as any).showSite(id, far), { id, far });
    const surfaces = (model: any[]) => model.map((m) => m.surface);
    const mode = (value: string) =>
      page.evaluate((value) => {
        const { w } = (window as any).fixture;
        w.settings.gatheringScenery = value;
      }, value);
    const id = sites[0].id;
    const untouched = await show(id);
    expect(surfaces(untouched)).not.toContain('wood');
    await mode('always-worked');
    expect(surfaces(await show(id)), 'live mode edit restores legacy worked timber').toContain(
      'wood',
    );
    await mode('worked-near-settlements');
    for (const site of sites) {
      for (const far of [false, true]) {
        const natural = await show(site.id, far);
        expect(natural, `${site.region} ${site.item} is streamed`).not.toBeNull();
        for (const surface of ['wood', 'metal', 'rubber', 'cutStone'])
          expect(surfaces(natural)).not.toContain(surface);
        await page.screenshot({
          path: `test-results/gathering-${site.region}-${site.item}-${far ? 'far' : 'near'}.png`,
        });
      }
      const natural = await show(site.id);
      await page.evaluate((id) => {
        const { w } = (window as any).fixture;
        w.resources[id] = { amount: 0, updated: w.time };
      }, site.id);
      const worn = await show(site.id);
      await page.screenshot({
        path: `test-results/gathering-${site.region}-${site.item}-worn.png`,
      });
      expect(
        worn.reduce((n: number, m: any) => n + m.triangles, 0) -
          natural.reduce((n: number, m: any) => n + m.triangles, 0),
      ).toBe(4);
      for (const surface of ['wood', 'metal', 'rubber', 'cutStone'])
        expect(surfaces(worn)).not.toContain(surface);
      await mode('natural');
      expect(await show(site.id)).toEqual(natural);
      await mode('worked-near-settlements');
      await page.evaluate((id) => {
        const { w, nodes } = (window as any).fixture;
        w.resources[id] = { amount: nodes.find((n: any) => n.id === id).capacity, updated: w.time };
      }, site.id);
      expect(await show(site.id), 'recently used full site still shows wear').toEqual(worn);
      await page.evaluate((id) => {
        const { w, nodes } = (window as any).fixture;
        w.resources[id] = {
          amount: nodes.find((n: any) => n.id === id).capacity,
          updated: w.time - 601,
        };
      }, site.id);
      expect(await show(site.id), 'expired fully regrown site loses wear without reload').toEqual(
        natural,
      );
    }
    expect(errors).toEqual([]);
  } finally {
    await server.close();
  }
});

test('owner edits gathering scenery and thresholds in F10 and invalid thresholds stay unapplied', async ({
  page,
}) => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createApp } = await import('../../src/server/app');
  const { addPlayer } = await import('../../src/shared/simulation');
  const { creatorSchema } = await import('../../src/shared/creator');
  const { waitForWorld } = await import('./fixtures/ready');
  const dir = mkdtempSync(join(tmpdir(), 'aclone-gathering-rules-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  try {
    const { account, token } = app.universe.register('Scenery builder');
    const w = createWorld('gathering-rules', 'Gathering rules', account.id);
    w.script = '';
    w.settings.mapSize = 500;
    w.settings.dayLength = 0;
    w.settings.time = 43200;
    w.settings.hungerRate = w.settings.thirstRate = 0;
    w.creator = creatorSchema.parse({ scenery: false, weather: 'clear' });
    addPlayer(w, account.id, account.name);
    app.worlds.set(w.id, w);
    const port = await app.listen();
    await page.addInitScript(
      ({ token, world }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', world);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, world: w.id },
    );
    await page.goto(`http://127.0.0.1:${port}`);
    await waitForWorld(page);
    for (const [mode, distance, seconds] of [
      ['natural', 0, 0],
      ['always-worked', 200, 45],
      ['worked-near-settlements', 100, 600],
    ] as const) {
      await page.keyboard.press('F10');
      await page.getByRole('button', { name: 'Rules', exact: true }).click();
      const form = page.locator('#settings-form');
      await form.locator('[name="gatheringScenery"]').selectOption(mode);
      await form.locator('[name="gatheringTownDistance"]').fill(String(distance));
      await form.locator('[name="gatheringRecentSeconds"]').fill(String(seconds));
      await form
        .locator('[name="gatheringScenery"]')
        .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      if (mode === 'worked-near-settlements')
        await page.screenshot({ path: 'test-results/gathering-rules.png' });
      await form.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
      await expect
        .poll(() => [
          w.settings.gatheringScenery,
          w.settings.gatheringTownDistance,
          w.settings.gatheringRecentSeconds,
        ])
        .toEqual([mode, distance, seconds]);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('F10');
    await page.getByRole('button', { name: 'Rules', exact: true }).click();
    const form = page.locator('#settings-form');
    await form.locator('[name="gatheringTownDistance"]').fill('-1');
    expect(await form.evaluate((el: HTMLFormElement) => el.checkValidity())).toBe(false);
    await form.getByRole('button', { name: 'Apply changes to server', exact: true }).click();
    expect(w.settings.gatheringTownDistance).toBe(100);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
