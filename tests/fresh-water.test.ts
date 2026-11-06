// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation';
import { buildings } from '../src/shared/catalog';
import {
  pumpHouseSite,
  pumpHouseRecipe,
  refreshPumpRecipes,
  waterProductionBlocker,
} from '../src/shared/fresh-water';
import { prepareWaterSources } from '../src/shared/springs';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
function springWorld() {
  const w = createWorld('spring-pump', 'Spring pump', 'owner');
  w.buildings = [];
  Object.assign(w.settings, { seaLevel: -2, tidalRange: 0, mapSize: 500 });
  w.terrainMapSize = 500;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(30),
  };
  w.springs = [{ id: 'spring-source', x: 100, z: 100, flow: 0.6 }];
  prepareWaterSources(w);
  return w;
}
test('pump-house catalogue is a cheaper qualified water producer', () => {
  assert.equal(buildings.pumpHouse?.name, 'Pump-house');
  assert.equal(buildings.pumpHouse.price, 90000);
  assert.deepEqual(buildings.pumpHouse.materials, { wood: 6, blocks: 6, steel: 1, gravel: 4 });
  assert.equal(buildings.pumpHouse.idealEmployees, 2);
  assert.equal(buildings.waterworks.name, 'Desalination plant');
});
test('spring intake snaps to a saved source, reserves it, and releases no phantom river reach', () => {
  const w = springWorld(),
    b = makeBuilding('pump', 'pumpHouse', 103, 108);
  b.rotation = 0;
  const site = pumpHouseSite(w, b)!;
  assert.ok(site);
  assert.equal(site.x, 100);
  assert.equal(site.intake.x, 100);
  assert.equal(site.intake.z, 100);
  Object.assign(b, site);
  w.buildings.push(b);
  assert.equal(b.waterSource?.spring, 'spring-source');
  assert.equal(b.waterSource?.river, undefined);
  assert.equal(pumpHouseSite(w, { ...b, id: 'other' }), undefined);
  assert.equal(waterProductionBlocker(w, b), undefined);
  w.springs = [];
  assert.match(waterProductionBlocker(w, b) ?? '', /source|spring|intake/i);
});
test('fuel, gravity and flow recipes share live world rules while explicit premises overrides survive', () => {
  const w = springWorld(),
    b = makeBuilding('pump', 'pumpHouse', 100, 108);
  Object.assign(b, pumpHouseSite(w, b));
  w.buildings = [b];
  assert.deepEqual(pumpHouseRecipe(w, b).inputs, { fuel: 1 });
  assert.deepEqual(pumpHouseRecipe(w, b).outputs, { water: 20 });
  refreshPumpRecipes(w);
  assert.equal(b.production!.outputs.water, 20);
  w.settings.pumpFlowScaling = true;
  refreshPumpRecipes(w);
  assert.equal(b.production!.outputs.water, 12);
  w.settings.pumpGravityEnabled = true;
  refreshPumpRecipes(w);
  assert.deepEqual(b.production!.inputs, {});
  assert.equal(b.production!.outputs.water, 5);
  b.pumpRecipeManaged = undefined;
  b.production = {
    inputs: { fuel: 2 },
    outputs: { water: 99 },
    seconds: 600,
    skill: 'pump operator',
    tier: 0,
  };
  w.settings.pumpWaterPerBatch = 30;
  refreshPumpRecipes(w);
  assert.equal(b.production.outputs.water, 99);
});
test('real northern river banks accept pumps and reject neighbours inside the river spacing', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  expandPuddlewickIsland(w);
  w.buildings = [];
  prepareWaterSources(w);
  let site: ReturnType<typeof pumpHouseSite>;
  let b = makeBuilding('river-pump', 'pumpHouse', 0, 0);
  for (const river of w.northernIsland!.rivers) {
    const banks = riverBanks(river.points);
    for (let i = 4; i < river.points.length - 4 && !site; i += 2)
      for (const side of ['left', 'right'] as const) {
        const p = river.points[i],
          bank = banks[i][side],
          d = Math.hypot(bank.x - p.x, bank.z - p.z),
          nx = (bank.x - p.x) / d,
          nz = (bank.z - p.z) / d;
        Object.assign(b, { x: bank.x + nx * 5, z: bank.z + nz * 5, rotation: Math.atan2(nx, nz) });
        site = pumpHouseSite(w, b);
        if (site) break;
      }
    if (site) break;
  }
  assert.ok(
    site,
    'a dry full pump footprint with fresh intake is available on the northern island',
  );
  Object.assign(b, site);
  w.buildings = [b];
  assert.ok(b.waterSource?.river);
  assert.equal(pumpHouseSite(w, { ...b, id: 'nearby' }), undefined);
  assert.equal(waterProductionBlocker(w, b), undefined);
  const coast = makeBuilding('coast', 'pumpHouse', 0, 144);
  assert.equal(pumpHouseSite(w, coast), undefined);
});

import { act, addPlayer, advance, productionInterval } from '../src/shared/simulation';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { productionActivity } from '../src/shared/sound-state';
import { workplace } from '../src/server/npc/workplace';
test('authoritative construction snaps before charging, rejects taken/dry sites, and saves the fixed intake', () => {
  const w = springWorld(),
    p = addPlayer(w, 'owner', 'Builder');
  Object.assign(p, { x: 101, z: 108, cash: 1000000 });
  act(w, p.id, { type: 'construct', kind: 'pumpHouse', rotation: 0 });
  const b = w.buildings[0];
  assert.equal(b.x, 100);
  assert.equal(b.waterSource?.spring, 'spring-source');
  assert.equal(b.production?.outputs.water, 20);
  const before = JSON.stringify(w);
  assert.throws(() =>
    act(w, p.id, { type: 'construct', kind: 'pumpHouse', x: 130, z: 130, rotation: 0 }),
  );
  assert.equal(JSON.stringify(w), before);
  const copy = createWorld('copy-pump', 'Copy', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.deepEqual(copy.buildings[0].waterSource, b.waterSource);
  assert.equal(copy.buildings[0].pumpRecipeManaged, true);
  delete b.construction;
  b.government = true;
  b.stock = { fuel: 3 };
  advance(w, productionInterval(w, b));
  assert.equal(b.stock.water, 20);
  assert.equal(b.stock.fuel, 2);
  w.springs = [];
  const stock = { ...b.stock };
  advance(w, 1200);
  assert.deepEqual(b.stock, stock);
  assert.equal(productionActivity(w, b), 0);
  assert.match(workplace(w, p, b)!.blockers.join(' '), /source|intake/i);
});
test('editor placement and premises recipe overrides use the same pump rules', () => {
  const w = springWorld(),
    p = addPlayer(w, 'owner', 'Editor');
  Object.assign(p, { x: 100, z: 108 });
  act(w, p.id, { type: 'place', kind: 'pumpHouse', x: 100, z: 108, rotation: 0 });
  const b = w.buildings[0];
  assert.ok(b.waterSource);
  assert.equal(b.production?.outputs.water, 20);
  act(w, p.id, {
    type: 'production',
    building: b.id,
    inputs: { fuel: 2 },
    outputs: { water: 44 },
    seconds: 100,
    skill: 'pump operator',
  });
  act(w, p.id, { type: 'settings', patch: { pumpWaterPerBatch: 30 } });
  advance(w, 1);
  assert.equal(b.production?.outputs.water, 44);
  assert.equal(b.pumpRecipeManaged, undefined);
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'place', kind: 'pumpHouse', x: 200, z: 100, rotation: 0 }),
    /fresh water/i,
  );
  assert.equal(JSON.stringify(w), before);
});

import { nearestWaterSite, preferredWaterProducer } from '../src/shared/water-sites';
import { pickBuildSite } from '../src/server/npc/chains';
test('water founding searches the actual northern island and prefers a nearby fresh source', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  expandPuddlewickIsland(w);
  prepareWaterSources(w);
  w.buildings = [];
  const spring = w.springs!.find((s) => !s.river && s.z < -1000)!;
  const p = addPlayer(w, 'founder', 'Founder');
  Object.assign(p, { x: spring.x, z: spring.z, cash: 10000000 });
  const fresh = nearestWaterSite(w, p, 'pumpHouse');
  assert.ok(fresh);
  assert.ok(fresh.z < -1000);
  assert.ok(Math.hypot(fresh.x - p.x, fresh.z - p.z) < 100);
  assert.ok(pumpHouseSite(w, { id: 'construction', kind: 'pumpHouse', ...fresh }));
  assert.equal(preferredWaterProducer(w, p), 'pumpHouse');
  assert.deepEqual(pickBuildSite(w, p, 'pumpHouse'), fresh);
  const shore = nearestWaterSite(w, { x: 0, z: 140 }, 'waterworks');
  assert.ok(shore);
  assert.ok(Math.abs(shore.z - 140) < 150);
  assert.equal(preferredWaterProducer(w, { x: shore.x, z: shore.z }), 'waterworks');
});

import { inlandWaterAt } from '../src/shared/inland-water';
import { riverDockReserved } from '../src/shared/river-dock';
import { dockReserved } from '../src/shared/boathouse';
test('pond pumps require depth and freeboard, and pump intakes reserve no boat reach', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.springs = [];
  prepareWaterSources(w);
  let site: ReturnType<typeof pumpHouseSite>;
  const b = makeBuilding('pond-pump', 'pumpHouse', 0, 0);
  for (const pond of w.northernIsland!.ponds) {
    for (let i = 0; i < 128 && !site; i++)
      for (const back of [3, 4, 5, 6, 7, 8]) {
        const a = (i * Math.PI) / 64;
        Object.assign(b, {
          x: pond.x + Math.sin(a) * (pond.rx + back),
          z: pond.z + Math.cos(a) * (pond.rz + back),
          rotation: a,
        });
        site = pumpHouseSite(w, b);
        if (site) break;
      }
    if (site) break;
  }
  assert.ok(site, 'a real pond has a dry buildable bank and deep intake');
  Object.assign(b, site);
  w.buildings = [b];
  assert.equal(b.waterSource?.river, undefined);
  assert.equal(b.waterSource?.spring, undefined);
  assert.equal(waterProductionBlocker(w, b), undefined);
  assert.equal(riverDockReserved(b, site.intake.x, site.intake.z, 20), false);
  assert.equal(dockReserved(b, site.intake.x, site.intake.z, 20), false);
  const water = inlandWaterAt(w, site.intake.x, site.intake.z)!;
  assert.ok(water.depth >= 0.4);
  w.settings.pumpIntakeDepth = 10;
  assert.equal(pumpHouseSite(w, b), undefined);
  assert.match(waterProductionBlocker(w, b) ?? '', /intake/);
  w.settings.pumpIntakeDepth = 0.4;
  w.settings.pumpFreeboard = 3;
  assert.equal(pumpHouseSite(w, b), undefined);
  w.settings.pumpFreeboard = 0.3;
  w.terrain.push({ ...site.intake, radius: 2, height: 30 });
  w.revision++;
  assert.match(waterProductionBlocker(w, b) ?? '', /intake/);
});

test('moving a pump cannot draw from a remote saved intake and portable designs cannot duplicate a spring claim', () => {
  const w = springWorld(),
    b = makeBuilding('pump', 'pumpHouse', 100, 108);
  Object.assign(b, pumpHouseSite(w, b));
  w.buildings = [b];
  refreshPumpRecipes(w);
  b.x += 30;
  assert.match(waterProductionBlocker(w, b) ?? '', /intake/);
  b.x -= 30;
  assert.equal(waterProductionBlocker(w, b), undefined);
  const design = exportDesign(w);
  design.buildings.push({ ...structuredClone(design.buildings[0]), id: 'duplicate', x: 140 });
  const other = createWorld('duplicate-water', 'Duplicate', 'owner');
  const before = JSON.stringify(other);
  assert.throws(() => applyDesign(other, design), /spring.*claimed|spring.*pump/i);
  assert.equal(JSON.stringify(other), before);
});

test('spring snapping cannot move a paid construction footprint onto farmland', () => {
  const w = springWorld(),
    p = addPlayer(w, 'owner', 'Builder');
  w.zones = [];
  w.roads = [];
  const farm = makeBuilding('farmer', 'farm', 44, 99);
  farm.rotation = 0;
  farm.farmPlots = 12;
  w.buildings = [farm];
  Object.assign(p, { x: 103, z: 108, cash: 1000000 });
  const site = pumpHouseSite(w, {
    ...makeBuilding('construction', 'pumpHouse', p.x, p.z),
    rotation: 0,
  });
  assert.ok(site);
  assert.equal(site.x, 100);
  const before = JSON.stringify(w);
  assert.throws(
    () => act(w, p.id, { type: 'construct', kind: 'pumpHouse', rotation: 0 }),
    /farmland/i,
  );
  assert.equal(JSON.stringify(w), before);
});
