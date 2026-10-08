// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  makeBuilding,
  addPlayer,
  act,
  advance,
  move,
  terrainHeight,
} from '../src/shared/simulation.ts';
import { waterworksSite, nearestWaterworksSite } from '../src/shared/shoreline.ts';
import { buildings, skills } from '../src/shared/catalog.ts';
import { productionActivity } from '../src/shared/sound-state.ts';
import { Navigator } from '../src/server/npc/navigation.ts';
import { selectLoops } from '../src/client/sound-scene.ts';
import { stepSchema } from '../src/server/npc/decision.ts';
import { adaptiveChoices } from '../src/server/npc/adaptive.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { workplace } from '../src/server/npc/workplace.ts';
import { Store } from '../src/server/store.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

function setup() {
  const w = createWorld('shore', 'Shore', 'owner');
  w.buildings = [];
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const p = addPlayer(w, 'owner', 'Builder');
  p.cash = 1000000;
  return { w, p };
}
test('waterworks must sit on dry shoreline terrain, even for editors; invalid attempts consume nothing', () => {
  const { w, p } = setup();
  for (const z of [0, 155, 180]) {
    p.x = 0;
    p.z = z;
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'construct', kind: 'waterworks' }), /shoreline/);
    assert.equal(JSON.stringify(w), before);
    assert.throws(() => act(w, p.id, { type: 'place', kind: 'waterworks', x: 0, z }), /shoreline/);
    assert.equal(JSON.stringify(w), before);
  }
  p.x = 0;
  p.z = 144;
  assert.ok(waterworksSite(w, p));
  act(w, p.id, { type: 'construct', kind: 'waterworks' });
  const b = w.buildings[0];
  assert.equal(b.kind, 'waterworks');
  assert.deepEqual(b.stock, {});
  assert.deepEqual(b.construction, buildings.waterworks.materials);
  assert.ok(waterworksSite(w, b, b.rotation));
  assert.ok(skills.includes('pump operator'));
  p.inventory = { ...buildings.waterworks.materials };
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction, undefined);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.buildings[0], b);
  } finally {
    store.close();
  }
});
test('editable terrain, water level and no-build zones govern siting; nearby placement cannot build remotely', () => {
  const { w, p } = setup();
  const site = nearestWaterworksSite(w, p)!;
  assert.ok(site && waterworksSite(w, site));
  assert.throws(
    () => act(w, p.id, { type: 'construct', kind: 'waterworks', ...site }),
    /four metres/,
  );
  p.x = site.x;
  p.z = site.z;
  w.zones.push({ id: 'protected', kind: 'noBuild', ...site, radius: 1000 });
  assert.equal(nearestWaterworksSite(w, p), undefined);
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'waterworks' }), /prohibited/);
  w.zones = [];
  w.settings.seaLevel = -50;
  assert.equal(waterworksSite(w, site), undefined);
  assert.equal(nearestWaterworksSite(w, p), undefined);
  w.settings.seaLevel = -2;
  // A terraformed inland pond is water too; a coastline is not a hard-coded z coordinate.
  w.terrain = [{ x: 0, z: 0, radius: 12, height: -10 }];
  assert.ok(waterworksSite(w, { x: 15, z: 0 }));
});
test('shoreline production consumes fuel, pays qualified labour and stops for a dry intake or flooding', () => {
  const { w } = setup();
  const b = makeBuilding('pump', 'waterworks', 0, 144);
  b.rotation = waterworksSite(w, b)!.rotation;
  b.stock = { fuel: 3 };
  b.investment = 10000;
  w.buildings = [b];
  const p = addPlayer(w, 'pump-worker', 'Operator');
  p.x = 0;
  p.z = 140;
  assert.throws(() => act(w, p.id, { type: 'job', building: b.id }), /skill|qualification|learn/i);
  p.skills = ['pump operator'];
  act(w, p.id, { type: 'job', building: b.id });
  const cash = p.cash;
  b.operating = productionActivity(w, b);
  assert.ok(selectLoops(w, p, p).some((s) => s.id === `building:${b.id}` && s.kind === 'pump'));
  assert.equal(productionActivity(w, b), 1);
  advance(w, 600);
  assert.equal(b.stock.fuel, 2);
  assert.equal(b.stock.water, 12);
  assert.equal(b.investment, 7800);
  assert.equal(p.cash, cash + 1980);
  for (const level of [-50, 50]) {
    w.settings.seaLevel = level;
    b.operating = productionActivity(w, b);
    assert.equal(b.operating, 0);
    assert.ok(!selectLoops(w, p, p).some((s) => s.id === `building:${b.id}`));
    assert.match(workplace(w, p, b)!.blockers.join(' '), /intake|flooded/);
    assert.equal(workplace(w, p, b)!.efficiencyNextCycle, 0);
    advance(w, 600);
    assert.equal(b.stock.water, 12);
    assert.equal(b.stock.fuel, 2);
    assert.equal(b.investment, 7800);
  }
  w.settings.seaLevel = -2;
  act(w, p.id, { type: 'work', building: b.id });
  advance(w, 600);
  assert.equal(b.stock.water, 24);
  b.stock.fuel = 0;
  assert.equal(productionActivity(w, b), 0);
  advance(w, 600);
  assert.equal(b.stock.water, 24);
});
test('NPC construction choices survey a legal shoreline and use the same authoritative placement', () => {
  const { w, p } = setup();
  const choices = adaptiveChoices(w, p, { plan: [], index: 0 } as unknown as ResidentState);
  const choice = choices.find(
    (c) =>
      c.description.includes('Shoreline waterworks') &&
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'construct' &&
          s.parameters.some((p) => p.name === 'kind' && p.value === 'waterworks'),
      ),
  );
  assert.ok(choice, 'waterworks is actually offered to the decision model');
  for (const s of choice.plan) {
    stepSchema.parse(s);
    if (s.kind === 'move') {
      const nav = new Navigator(w, p, s, 3);
      let arrived = false;
      for (let i = 0; i < 6000; i++) {
        const result = nav.step(w, p, 0.05);
        assert.equal(result.error, undefined);
        move(w, p, result.input, 0.05);
        assert.ok(terrainHeight(w, p.x, p.z) >= w.settings.seaLevel);
        if (result.arrived) {
          arrived = true;
          break;
        }
      }
      assert.ok(arrived, 'ordinary navigation reaches the surveyed shore');
    } else if (s.kind === 'act') act(w, p.id, s.action);
    else if (s.kind === 'operation') act(w, p.id, operationAction(s));
  }
  assert.equal(w.buildings[0].kind, 'waterworks');
  assert.ok(waterworksSite(w, w.buildings[0], w.buildings[0].rotation));
});
test('water pricing upgrade preserves private owners and unrelated public edits', () => {
  const { w } = setup();
  w.tradePricing = 2;
  const kitchen = makeBuilding('k', 'kitchen', 0, 0),
    inn = makeBuilding('inn', 'bnb', 40, 0);
  const owned = makeBuilding('private', 'teaHouse', 80, 0);
  kitchen.buy.water = 868;
  kitchen.buy.potatoes = 111;
  inn.buy.water = 868;
  inn.sell.water = 1047;
  owned.owner = 'someone';
  owned.buy.water = 868;
  w.buildings = [kitchen, inn, owned];
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const next = store.loadWorlds()[0].world;
    assert.equal(next.tradePricing, 4);
    assert.equal(next.buildings[0].buy.water, 660);
    assert.equal(next.buildings[0].buy.potatoes, 111);
    assert.equal(next.buildings[1].sell.water, 725);
    assert.deepEqual(next.buildings[2], owned);
    store.saveWorld(next);
    assert.deepEqual(store.loadWorlds()[0].world, next);
  } finally {
    store.close();
  }
});
