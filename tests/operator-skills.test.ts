// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, act } from '../src/shared/simulation.ts';
import { worldSkills, catalogueSchema } from '../src/shared/world-catalogue.ts';
import { Store } from '../src/server/store.ts';
import type { World } from '../src/shared/types.ts';

function setup() {
  const w = createWorld('operator-test', 'Test', 'tester');
  w.settings.maxOfflineDays = 0;
  w.settings.loseSkillsOnDeath = true;
  w.settings.maxSkills = 1;
  w.catalogue = catalogueSchema.parse({
    skills: {
      'custom:surveyor': { name: 'Surveyor', price: 1, seconds: 1 },
    },
  });
  const p = addPlayer(w, 'tester', 'HANK_ROMP');
  Object.assign(p, { operatorAllSkills: true });
  p.skills = ['miller'];
  p.learning = { skill: 'baker', end: 1000 };
  return { w, p };
}
function die(w: World) {
  const p = w.players.tester;
  const deaths = p.deaths;
  p.health = 1;
  p.hunger = p.thirst = 50000;
  p.inventory = {};
  advance(w, 1);
  assert.equal(p.deaths, deaths + 1);
}
function allSkills(w: World) {
  assert.deepEqual([...w.players.tester.skills].sort(), [...new Set(worldSkills(w))].sort());
  assert.equal(w.players.tester.learning, undefined);
}

test('explicit tester grant restores the world catalogue on join, without duplicates', () => {
  const { w, p } = setup();
  assert.equal(addPlayer(w, p.id, p.name), p);
  allSkills(w);
  addPlayer(w, p.id, p.name);
  allSkills(w);
  assert.equal(w.settings.maxSkills, 1);
});

test('tester retains all skills after repeated offline deaths and SQLite save/load', () => {
  const { w } = setup();
  die(w);
  allSkills(w);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const saved = store.loadWorlds()[0].world;
    die(saved);
    allSkills(saved);
    assert.equal(saved.players.tester.deaths, 2);
    assert.equal(saved.settings.loseSkillsOnDeath, true);
  } finally {
    store.close();
  }
});

test('grant changes only skill loss, not inventory, cash, property or death mechanics', () => {
  const { w, p } = setup();
  p.skills = [...worldSkills(w)];
  delete p.learning;
  p.cash = 100000;
  p.bank = 10000;
  w.settings.deathCashRetention = 0.5;
  w.settings.deathBankRetention = 0.5;
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.owner = p.id;
  const ordinary = structuredClone(w);
  delete (ordinary.players.tester as typeof p & { operatorAllSkills?: boolean }).operatorAllSkills;
  // Use identical injury setup but retain stock to check the actual inventory penalty.
  for (const world of [w, ordinary]) {
    const player = world.players.tester;
    player.health = 1;
    player.hunger = player.thirst = 50000;
    player.inventory = { wheat: 3 };
    advance(world, 1);
    assert.equal(player.deaths, 1);
    assert.deepEqual(player.inventory, {});
    assert.equal(player.cash, 50000);
    assert.equal(world.buildings.find((b) => b.id === mill.id)!.owner, undefined);
  }
  allSkills(w);
  assert.deepEqual(ordinary.players.tester.skills, []);
  const comparison = structuredClone(p) as typeof p & { operatorAllSkills?: boolean };
  delete comparison.operatorAllSkills;
  comparison.skills = [];
  assert.deepEqual(comparison, ordinary.players.tester);
});

test('name and world-owner authority do not grant skills; revocation restores death loss', () => {
  const { w, p } = setup();
  delete (p as typeof p & { operatorAllSkills?: boolean }).operatorAllSkills;
  addPlayer(w, p.id, p.name);
  assert.deepEqual(p.skills, ['miller']);
  assert.equal(p.authority, 20);
  assert.throws(() => act(w, p.id, { type: 'operatorAllSkills', enabled: true }));
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { operatorAllSkills: true } }));
  die(w);
  assert.deepEqual(p.skills, []);
});
