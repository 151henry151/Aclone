// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
import { riverDockSite } from '../src/shared/river-dock';
import { constructionSiteReason } from '../src/shared/construction-site';
import { surfaceWaterLevel } from '../src/shared/ocean';
import { terrainHeight } from '../src/shared/terrain';
import { rescueAction, LIFEBOAT } from '../src/shared/boat-rescue';
import { moveTow, towAction } from '../src/shared/towing';
import { moveTender, tenderAction, tenderOf } from '../src/shared/boat-tender';
import { MOTORBOAT, mooringKey } from '../src/shared/boats';
import { creatorSchema } from '../src/shared/creator';

const base = createWorld('puddlewick', 'Puddlewick', 'server');
base.settings.mapSize = 18500;
base.terrainMapSize = 12500;
base.townLayout = 2;
expandPuddlewickIsland(base);
base.buildings = [];
base.settings.vehicleLicences = false;
base.settings.requireCaptainSkill = false;
function setup() {
  const w = structuredClone(base),
    p = addPlayer(w, 'p', 'Captain');
  Object.assign(p, {
    vehicle: 3,
    fleet: [0, 5, 3, MOTORBOAT],
    fuel: 0,
    fuelVehicle: 3,
    inventory: { cod: 7 },
    speed: 0,
    engine: false,
    online: true,
  });
  return { w, p };
}
function dock(w: typeof base) {
  const r = w.northernIsland!.rivers[0],
    banks = riverBanks(r.points);
  for (let i = Math.floor(r.points.length * 0.55); i < r.points.length - 3; i++)
    for (const side of ['left', 'right'] as const) {
      const pt = r.points[i],
        bank = banks[i][side],
        d = Math.hypot(bank.x - pt.x, bank.z - pt.z),
        nx = (bank.x - pt.x) / d,
        nz = (bank.z - pt.z) / d;
      const b = makeBuilding('river-dock', 'riverDock', bank.x + nx * 3.5, bank.z + nz * 3.5);
      b.rotation = Math.atan2(nx, nz);
      if (!constructionSiteReason(w, b)) return { b, site: riverDockSite(w, b)! };
    }
  throw Error('No river dock fixture');
}
test('an empty-fuel boat launches and recovers its lifeboat on an elevated real river without moving cargo', () => {
  const { w, p } = setup(),
    r = w.northernIsland!.rivers[0],
    i = Math.floor(r.points.length * 0.7),
    pt = r.points[i];
  Object.assign(p, pt, {
    y: pt.level,
    heading: Math.atan2(r.points[i + 1].x - pt.x, r.points[i + 1].z - pt.z),
  });
  assert.ok(pt.level > w.settings.seaLevel + 5);
  const position = { x: p.x, z: p.z },
    cargo = { ...p.inventory };
  rescueAction(w, p, 'launch');
  assert.equal(p.vehicle, LIFEBOAT);
  assert.equal(p.y, surfaceWaterLevel(w, p.x, p.z));
  assert.deepEqual(w.boatRescues!.p.cargo, cargo);
  assert.deepEqual({ x: w.boatRescues!.p.boat.x, z: w.boatRescues!.p.boat.z }, position);
  assert.deepEqual(p.inventory, {});
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }), /dock|shore|landing/i);
  const saved = JSON.parse(JSON.stringify(w)),
    rower = saved.players.p;
  rower.inventory = { fuel: 1 };
  rescueAction(saved, rower, 'reboard');
  assert.equal(rower.vehicle, 3);
  assert.equal(rower.y, surfaceWaterLevel(saved, rower.x, rower.z));
  assert.deepEqual(rower.inventory, { ...cargo, fuel: 1 });
  assert.equal(rower.fuel, 0);
  assert.equal(saved.boatRescues.p, undefined);
  assert.throws(() => rescueAction(saved, rower, 'reboard'), /no lifeboat/i);
});
test('a lifeboat moored at a real river dock boards at local elevation and preserves the stranded vessel', () => {
  const { w, p } = setup(),
    { b, site } = dock(w);
  w.buildings = [b];
  Object.assign(p, site.land, { vehicle: 5, inventory: { fuel: 1 } });
  w.boatRescues = {
    p: {
      boat: { x: site.berth.x + 30, z: site.berth.z, heading: 0, slot: 3, paint: 'blue' },
      cargo: { cod: 7 },
      dinghy: { ...site.berth, heading: site.heading, moored: true, landing: b.id },
    },
  };
  const vessel = structuredClone(w.boatRescues.p.boat);
  rescueAction(w, p, 'board');
  assert.equal(p.y, surfaceWaterLevel(w, p.x, p.z));
  assert.deepEqual(w.boatRescues.p.boat, vessel);
  assert.deepEqual(p.inventory, { fuel: 1 });
  assert.deepEqual(w.boatRescues.p.cargo, { cod: 7 });
});
function straight() {
  const s = setup();
  s.w.northernIsland!.ponds = [];
  s.w.northernIsland!.rivers = [
    {
      id: 'test',
      name: 'Elevated test reach',
      points: [
        { x: 0, z: -11000, level: 100, width: 120, depth: 6 },
        { x: 0, z: -9000, level: 100, width: 120, depth: 6 },
      ],
    },
  ];
  Object.assign(s.p, { x: 0, z: -10000, y: 100, heading: 0 });
  return s;
}
function obstacle(w: typeof base, x: number, z: number) {
  w.creator = creatorSchema.parse({
    models: [{ id: 'barrier', name: 'Barrier', height: 4, parts: [{ shape: 'box' }] }],
    objects: [{ id: 'block', name: 'Block', model: 'barrier', x: 0, z: 0, solid: true, radius: 1 }],
  });
  Object.assign(w.creator.objects[0], { x, z, y: 100 - terrainHeight(w, x, z) });
}
test('occupied tow follows local river elevation and rejects an elevated obstacle without moving cargo', () => {
  const { w, p } = straight(),
    tug = addPlayer(w, 'tug', 'Tug');
  Object.assign(tug, {
    vehicle: 32,
    fleet: [0, 5, 32],
    fuel: 100,
    fuelVehicle: 32,
    online: true,
    x: 0,
    z: p.z + 40,
    y: 100,
    speed: 0,
    heading: 0,
  });
  towAction(w, tug, { type: 'tow', operation: 'offer', owner: p.id, fee: 0 });
  towAction(w, p, { type: 'tow', operation: 'accept' });
  towAction(w, tug, { type: 'tow', operation: 'hook', owner: p.id });
  let before = { x: tug.x, z: tug.z, heading: 0 };
  tug.z += 2;
  moveTow(w, tug, before);
  assert.ok(p.z > -9999);
  assert.equal(p.y, surfaceWaterLevel(w, p.x, p.z));
  obstacle(w, 0, p.z + 5);
  before = { x: tug.x, z: tug.z, heading: 0 };
  const target = { x: p.x, z: p.z };
  tug.z += 6;
  moveTow(w, tug, before);
  assert.equal(tug.z, before.z);
  assert.deepEqual({ x: p.x, z: p.z }, target);
  assert.deepEqual(p.inventory, { cod: 7 });
});
test('a tender cannot sweep through a solid object standing at river height', () => {
  const { w, p } = straight();
  w.mooredBoats = {
    [mooringKey(p.id, MOTORBOAT)]: {
      owner: p.id,
      slot: MOTORBOAT,
      x: p.x,
      z: p.z - 20,
      heading: 0,
      paint: 'blue',
      landing: '',
    },
  };
  tenderAction(w, p, 'hook');
  const t = tenderOf(w, p)!,
    before = { x: p.x, z: p.z, heading: 0 },
    old = { x: t.x, z: t.z };
  obstacle(w, 0, t.z + 4);
  p.z += 6;
  moveTender(w, p, before);
  assert.equal(p.z, before.z);
  assert.deepEqual({ x: t.x, z: t.z }, old);
  w.creator!.objects = [];
  p.z += 6;
  moveTender(w, p, before);
  assert.ok(t.z > old.z + 5);
});

test('captain death leaves a passenger lifeboat on the same river rather than at ocean datum', async () => {
  const { endVoyageOnDeath } = await import('../src/shared/fishing-expedition');
  const { w, p } = straight(),
    crew = addPlayer(w, 'crew', 'Crew');
  Object.assign(crew, { hitch: p.id, vehicle: 5, inventory: { water: 2 }, x: p.x, z: p.z, y: p.y });
  endVoyageOnDeath(w, p);
  assert.equal(crew.hitch, undefined);
  assert.equal(crew.vehicle, LIFEBOAT);
  assert.deepEqual([crew.x, crew.z], [p.x, p.z]);
  assert.equal(crew.y, surfaceWaterLevel(w, p.x, p.z));
  assert.deepEqual(crew.inventory, { water: 2 });
});

test('river launch refuses blocked alongside water and dry land atomically', () => {
  const { w, p } = straight();
  obstacle(w, p.x, p.z);
  w.creator!.objects[0].radius = 10;
  const before = structuredClone(p);
  assert.throws(() => rescueAction(w, p, 'launch'), /no clear water alongside/);
  assert.deepEqual(p, before);
  assert.equal(w.boatRescues, undefined);
  w.creator!.objects = [];
  p.x = 150;
  assert.ok(terrainHeight(w, p.x, p.z) > surfaceWaterLevel(w, p.x, p.z));
  assert.throws(() => rescueAction(w, p, 'launch'), /on water/);
  assert.equal(w.boatRescues, undefined);
  assert.deepEqual(p.inventory, { cod: 7 });
});
