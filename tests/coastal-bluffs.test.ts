// SPDX-License-Identifier: GPL-3.0-or-later
import { boatShoreCollision } from '../src/shared/boat-shore';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, move } from '../src/shared/simulation';
import { ensurePuddlewickLighthouses } from '../src/server/puddlewick-lighthouses';
import { terrainHeight } from '../src/shared/terrain';
import { bluffPoint, bluffEdge, cliffBlocks, bluffOutcrops } from '../src/shared/coastal-bluffs';
import { constructionSiteReason } from '../src/shared/construction-site';
import { lighthouseRange, lighthouseFlash } from '../src/shared/lighthouse-optics';

test('fifteen rocky headlands have sheer wet faces, safe level lighthouse sites and repeatable placement', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  ensurePuddlewickLighthouses(w);
  assert.equal(w.coastalBluffs!.length, 15);
  for (const b of w.coastalBluffs!) {
    const u = 17,
      edge = bluffEdge(b, u),
      top = bluffPoint(b, u, edge - 1),
      foot = bluffPoint(b, u, edge + 2);
    assert.ok(terrainHeight(w, top.x, top.z) - terrainHeight(w, foot.x, foot.z) > 25);
    assert.ok(terrainHeight(w, foot.x, foot.z) < terrainHeight(w, top.x, top.z) - 15);
    assert.ok(cliffBlocks(w, bluffPoint(b, 0, edge - 20), bluffPoint(b, 0, edge + 20)));
    assert.equal(cliffBlocks(w, bluffPoint(b, -20, -45), bluffPoint(b, 20, -45)), false);
  }
  for (const b of w.buildings.filter((b) => b.kind === 'lighthouse')) {
    assert.equal(
      constructionSiteReason({ ...w, buildings: w.buildings.filter((o) => o !== b) }, b),
      undefined,
    );
  }
  const before = JSON.stringify(w);
  assert.equal(ensurePuddlewickLighthouses(w), false);
  assert.equal(JSON.stringify(w), before);
});
test('old public lighthouse moves with its keeper, stock, ownership and job intact', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  w.lighthouseVersion = 1;
  const b = makeBuilding('parish-harbour-light', 'lighthouse', 26, 140);
  b.owner = 'keeper';
  b.stock.bread = 7;
  b.investment = 12345;
  w.buildings.push(b);
  const p = addPlayer(w, 'keeper', 'Keeper');
  p.home = b.id;
  p.job = b.id;
  p.atHome = true;
  b.employees = [p.id];
  const buildings = w.buildings
    .filter((o) => o !== b)
    .map((o) => [o.id, o.x, o.z, terrainHeight(w, o.x, o.z)]);
  ensurePuddlewickLighthouses(w);
  assert.equal(w.lighthouseVersion, 2);
  assert.equal(b.owner, p.id);
  assert.equal(b.stock.bread, 7);
  assert.equal(b.investment, 12345);
  assert.deepEqual(b.employees, [p.id]);
  assert.equal(p.x, b.x);
  assert.equal(p.z, b.z);
  for (const [id, x, z, h] of buildings) {
    const o = w.buildings.find((o) => o.id === id)!;
    assert.equal(o.x, x);
    assert.equal(o.z, z);
    assert.equal(terrainHeight(w, o.x, o.z), h);
  }
});
test('walkers and fast tractors stop before the lip, reverse away, and never fall', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  ensurePuddlewickLighthouses(w);
  w.buildings = [];
  const b = w.coastalBluffs![0],
    edge = bluffEdge(b, 0),
    start = bluffPoint(b, 0, edge - 10);
  for (const vehicle of [0, 5, 25]) {
    const p = addPlayer(w, 'test' + vehicle, 'Driver');
    Object.assign(p, start, {
      vehicle,
      heading: b.angle,
      speed: 30,
      engine: true,
      fuel: 100,
      atHome: false,
    });
    p.y = terrainHeight(w, p.x, p.z);
    for (let i = 0; i < 20; i++) move(w, p, { throttle: 1, steer: 0, boost: true }, 0.1);
    assert.ok(terrainHeight(w, p.x, p.z) > w.settings.seaLevel + 15);
    assert.equal(p.speed, 0);
    const before = { x: p.x, z: p.z };
    for (let i = 0; i < 30; i++) move(w, p, { throttle: -1, steer: 0, boost: false }, 0.1);
    assert.ok(Math.hypot(p.x - before.x, p.z - before.z) > 1);
  }
});
test('lighthouse construction requires a cliff; optical range and flashing obey height and direction', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  const b = makeBuilding('test', 'lighthouse', 100, 0);
  assert.match(constructionSiteReason(w, b)!, /cliff/);
  assert.ok(lighthouseRange(43, 3) > 29000);
  assert.ok(lighthouseRange(20, 2) < lighthouseRange(43, 3));
  assert.equal(lighthouseFlash(0, Math.PI, 0), 0);
  assert.equal(lighthouseFlash(0, 0, 0.3), 0);
  assert.equal(lighthouseFlash(0, 0, 0), 1);
});

test('offshore boulders are real solid terrain and obstruct boats', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  ensurePuddlewickLighthouses(w);
  const b = w.coastalBluffs![0];
  const rock = bluffOutcrops(b)[0],
    at = bluffPoint(b, rock.u, rock.v);
  assert.ok(terrainHeight(w, at.x, at.z) > w.settings.seaLevel + 1);
  const from = bluffPoint(b, rock.u, rock.v + 40);
  assert.ok(boatShoreCollision(w, from, at, 1.3, b.angle, 6));
});

test('headland crowns roll into inland terrain instead of forming level platforms', () => {
  const w = createWorld('puddlewick', 'P', 'server');
  ensurePuddlewickLighthouses(w);
  for (const b of w.coastalBluffs!) {
    const heights = [-60, -30, 0, 30, 60].flatMap((u) =>
      [-100, -80, -60, -40, -20].map((v) => {
        const p = bluffPoint(b, u, v);
        return terrainHeight(w, p.x, p.z);
      }),
    );
    assert.ok(Math.max(...heights) - Math.min(...heights) > 2, b.id);
    // Crossing the inland blend boundary must not introduce a terrace or seam.
    const end = -b.inland - 0.05;
    const a = bluffPoint(b, 0, end),
      c = bluffPoint(b, 0, end + 0.1);
    assert.ok(Math.abs(terrainHeight(w, a.x, a.z) - terrainHeight(w, c.x, c.z)) < 0.2);
  }
});
