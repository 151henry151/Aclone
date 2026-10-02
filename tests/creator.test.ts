// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, terrainHeight } from '../src/shared/simulation.ts';
import {
  creatorSchema,
  creatorEvent,
  tickCreator,
  creatorBlocks,
  drainCreatorScripts,
} from '../src/shared/creator.ts';
import { applyDesign, exportDesign, applyPreset } from '../src/server/world-design.ts';
import { Store } from '../src/server/store.ts';
function fixture() {
  const w = createWorld('workshop', 'Workshop', 'owner'),
    p = addPlayer(w, 'owner', 'Creator'),
    guest = addPlayer(w, 'guest', 'Visitor');
  w.script = '';
  p.online = guest.online = true;
  w.creator = creatorSchema.parse({
    models: [{ id: 'tree', name: 'Tree', parts: [{ shape: 'cone' }] }],
    objects: [{ id: 'oak', name: 'Oak', model: 'tree', x: 0, z: 0, solid: true }],
    rules: [
      {
        id: 'gift',
        name: 'Water tap',
        event: 'interact',
        target: 'oak',
        effects: [{ type: 'item', item: 'water', quantity: 1 }],
      },
    ],
  });
  p.x = guest.x = 0;
  p.z = guest.z = 0;
  return { w, p, guest };
}
test('owner-only creator edits validate atomically and protect referenced models', () => {
  const { w, p, guest } = fixture(),
    before = JSON.stringify(w.creator);
  assert.throws(() => act(w, guest.id, { type: 'creator', creator: w.creator }), /owner/i);
  assert.throws(
    () => act(w, p.id, { type: 'creator', creator: { ...w.creator, models: [] } }),
    /missing model/,
  );
  assert.equal(JSON.stringify(w.creator), before);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'creatorBuilding',
        building: w.buildings[0].id,
        patch: { x: 10, model: 'missing' },
      }),
    /Unknown model/,
  );
  assert.throws(() =>
    act(w, p.id, {
      type: 'creator',
      creator: { ...w.creator, objects: Array(129).fill(w.creator!.objects[0]) },
    }),
  );
});
test('interaction rules work for guests and honor distance, inventory, cooldown and team conditions', () => {
  const { w, p, guest } = fixture();
  guest.inventory = {};
  act(w, guest.id, { type: 'interactObject', object: 'oak' });
  assert.equal(guest.inventory.water, 1);
  act(w, guest.id, { type: 'interactObject', object: 'oak' });
  assert.equal(guest.inventory.water, 1);
  w.time += 31;
  act(w, guest.id, { type: 'interactObject', object: 'oak' });
  assert.equal(guest.inventory.water, 2);
  guest.x = 100;
  assert.throws(() => act(w, guest.id, { type: 'interactObject', object: 'oak' }), /Approach/);
  guest.x = 0;
  w.creator!.rules[0].team = 1;
  guest.team = 0;
  w.time += 31;
  creatorEvent(w, 'interact', guest, 'oak');
  assert.equal(guest.inventory.water, 2);
  w.creator!.rules[0].team = -1;
  w.creator!.rules[0].requiredItem = 'tools';
  creatorEvent(w, 'interact', guest, 'oak');
  assert.equal(guest.inventory.water, 2);
  assert.ok(creatorBlocks(w, 0, 0, terrainHeight(w, 0, 0), 1));
  w.creator!.objects[0].visible = false;
  assert.equal(creatorBlocks(w, 0, 0, 0, 1), false);
});
test('entry and timer rules run once per boundary/cooldown, exclude offline players, target tasks correctly', () => {
  const { w, p, guest } = fixture();
  p.online = false;
  guest.inventory = {};
  guest.y = terrainHeight(w, 0, 0);
  w.creator!.rules = creatorSchema.parse({
    rules: [
      {
        id: 'enter',
        name: 'Gate',
        event: 'enter',
        target: 'oak',
        cooldown: 1,
        effects: [{ type: 'item', item: 'water', quantity: 1 }],
      },
      {
        id: 'task',
        name: 'Reward',
        event: 'task',
        target: 'mill',
        effects: [{ type: 'item', item: 'bread', quantity: 1 }],
      },
    ],
  }).rules;
  tickCreator(w);
  assert.equal(guest.inventory.water, 1);
  w.time += 2;
  tickCreator(w);
  assert.equal(guest.inventory.water, 1);
  guest.x = 20;
  w.time += 2;
  tickCreator(w);
  guest.x = 0;
  w.time += 2;
  tickCreator(w);
  assert.equal(guest.inventory.water, 2);
  creatorEvent(w, 'task', guest, 'bakery');
  assert.equal(guest.inventory.bread, undefined);
  creatorEvent(w, 'task', guest, 'mill');
  assert.equal(guest.inventory.bread, 1);
  w.script = 'on("ObjectInteract", function(e) end)';
  creatorEvent(w, 'interact', guest, 'oak');
  assert.deepEqual(drainCreatorScripts(w), [
    { event: 'ObjectInteract', data: { id: guest.id, target: 'oak' } },
  ]);
  assert.equal(drainCreatorScripts(w).length, 0);
});
test('designs roundtrip live configuration but exclude players, savings and inventories', () => {
  const { w, p } = fixture();
  p.cash = 7654321;
  w.settings.dayLength = 7;
  w.buildings[0].stock.wheat = 333;
  w.buildings[0].investment = 99999;
  const design = exportDesign(w);
  const copy = createWorld('copy', 'Copy', 'new-owner');
  applyDesign(copy, JSON.parse(JSON.stringify(design)));
  assert.deepEqual(copy.creator, w.creator);
  assert.equal(copy.settings.dayLength, 7);
  assert.deepEqual(copy.players, {});
  assert.ok(!JSON.stringify(design).includes('7654321'));
  assert.notEqual(copy.buildings[0].investment, 99999);
  const store = new Store(':memory:');
  try {
    store.saveWorld(copy);
    assert.deepEqual(store.loadWorlds()[0].world.creator, copy.creator);
  } finally {
    store.close();
  }
});
test('arena presets clear town structures and configure actual victory settings', () => {
  const w = createWorld('arena', 'Arena', 'owner');
  applyPreset(w, 'ctf');
  assert.ok(w.buildings.every((b) => b.kind === 'starport'));
  assert.equal(w.creator!.arena.mode, 'ctf');
  assert.equal(w.creator!.arena.scoreLimit, 3);
  assert.equal(w.settings.hungerRate, 0);
  assert.equal(w.creator!.scenery, false);
});

test('custom CTF bases, round settings and weapon restrictions drive the actual match', async () => {
  const { w, p, guest } = fixture();
  w.settings.fighting = true;
  w.creator!.arena = {
    ...w.creator!.arena,
    mode: 'ctf',
    bases: [
      { x: -150, z: -150 },
      { x: 150, z: -150 },
    ],
    scoreLimit: 1,
    roundSeconds: 90,
    protectionSeconds: 7,
    weapons: ['machine'],
  };
  act(w, p.id, { type: 'joinCombat', mode: 'deathmatch' });
  act(w, guest.id, { type: 'joinCombat', mode: 'capture' });
  assert.equal(w.combat!.mode, 'ctf');
  assert.equal(w.combat!.ends, w.time + 90);
  assert.equal(p.x, -150);
  assert.equal(guest.x, 150);
  assert.equal(p.invulnerableUntil, w.time + 7);
  assert.throws(() => act(w, p.id, { type: 'fire', weapon: 'rocket' }), /disabled/);
  const { advance } = await import('../src/shared/simulation.ts');
  p.x = 150;
  p.z = -150;
  guest.x = 180;
  advance(w, 0.1);
  assert.equal(w.combat!.flags[1].carrier, p.id);
  p.x = -150;
  advance(w, 0.1);
  assert.equal(w.combat!.winner, 0);
  assert.ok(w.messages.some((m) => m.text.includes('Rust wins')));
});
test('swept custom obstacles stop fast movement and projectiles while allowing escape from an edited-in prop', async () => {
  const { w, p, guest } = fixture();
  const { creatorBlocksSegment } = await import('../src/shared/creator.ts');
  const y = terrainHeight(w, 0, 0) + 1;
  assert.equal(creatorBlocksSegment(w, { x: -8, y, z: 0 }, { x: 8, y, z: 0 }, 0.2), true);
  assert.equal(creatorBlocksSegment(w, { x: 0, y, z: 0 }, { x: 1, y, z: 0 }, 0.2, true), false);
  assert.equal(
    creatorBlocksSegment(w, { x: -8, y: y + 20, z: 0 }, { x: 8, y: y + 20, z: 0 }, 0.2),
    false,
  );
  w.buildings = [];
  w.zones = [];
  w.settings.fighting = true;
  p.x = 0;
  p.z = -7;
  p.y = terrainHeight(w, 0, -7);
  p.heading = 0;
  guest.x = 0;
  guest.z = 7;
  guest.y = terrainHeight(w, 0, 7);
  act(w, p.id, { type: 'fire', weapon: 'machine' });
  const { advance } = await import('../src/shared/simulation.ts');
  advance(w, 0.4);
  assert.equal(guest.health, 60000);
  assert.equal(w.projectiles.length, 0);
});
test('weather and road overrides remain consistent after design import', async () => {
  const { w } = fixture();
  w.creator!.weather = 'snowstorm';
  w.creator!.roads = false;
  const { worldWeather, advanceClimate } = await import('../src/shared/environment.ts');
  const { townRoads, streetLights } = await import('../src/shared/town.ts');
  const snow = worldWeather(w, 180);
  assert.equal(snow.precipitation, 'snow');
  assert.equal(snow.storm, true);
  advanceClimate(w, 0, 600);
  assert.ok(w.climate!.snow > 0);
  assert.equal(townRoads(w).length, 0);
  assert.equal(streetLights(w).length, 0);
  const copy = createWorld('climate-copy', 'Copy', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.equal(worldWeather(copy, 180).precipitation, 'snow');
  w.creator!.weather = 'clear';
  advanceClimate(w, 600, 1200);
  assert.equal(worldWeather(w, 180).precipitation, 'clear');
});

test('timer effects are limited per player and do not progress offline characters', () => {
  const { w, p, guest } = fixture();
  p.inventory = {};
  guest.inventory = {};
  guest.online = false;
  w.creator!.rules = creatorSchema.parse({
    rules: [
      {
        id: 'clock',
        name: 'Water allowance',
        event: 'timer',
        cooldown: 5,
        effects: [{ type: 'item', item: 'water', quantity: 1 }],
      },
    ],
  }).rules;
  tickCreator(w);
  assert.equal(p.inventory.water, 1);
  assert.equal(guest.inventory.water, undefined);
  w.time += 4;
  tickCreator(w);
  assert.equal(p.inventory.water, 1);
  w.time += 1;
  tickCreator(w);
  assert.equal(p.inventory.water, 2);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'creator',
        creator: { ...w.creator, rules: [{ ...w.creator!.rules[0], cooldown: 1 }] },
      }),
    /five seconds/,
  );
});
test('creation rules do not mint a temporary player balance or modify the starting ledger', async () => {
  const { configureRules } = await import('../src/server/world-design.ts');
  const w = createWorld('empty', 'Empty', 'owner'),
    before = structuredClone(w.ledger);
  configureRules(w, { startingCash: 123400 });
  assert.deepEqual(w.players, {});
  assert.deepEqual(w.ledger, before);
  const player = addPlayer(w, w.owner, 'Creator');
  assert.equal(player.cash, 123400);
});
