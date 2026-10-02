// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
function setup() {
  const w = createWorld('c', 'Combat', 'a', 'combat');
  const a = addPlayer(w, 'a', 'A'),
    b = addPlayer(w, 'b', 'B');
  a.online = b.online = true;
  a.x = 100;
  a.z = -50;
  a.heading = 0;
  b.x = 100;
  b.z = -40;
  return { w, a, b };
}
test('fast rounds use swept hits and cannot pass through safe zones', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'fire', weapon: 'machine' });
  advance(w, 0.2);
  assert.ok(b.health < 60000);
  a.lastShot = -10;
  b.health = 60000;
  w.zones.push({ id: 'shield', kind: 'safe', x: 100, z: -44, radius: 2 });
  act(w, a.id, { type: 'fire', weapon: 'machine' });
  advance(w, 0.2);
  assert.equal(b.health, 60000);
});
test('javelin charge is server timed and ammo mode cannot manufacture ammunition', () => {
  const { w, a } = setup();
  w.settings.weaponMode = 'ammo';
  assert.throws(() => act(w, a.id, { type: 'fire', weapon: 'javelin' }), /charge/i);
  act(w, a.id, { type: 'chargeWeapon', weapon: 'javelin' });
  advance(w, 1);
  act(w, a.id, { type: 'fire', weapon: 'javelin' });
  assert.equal(a.ammo?.javelin, 5);
  assert.ok(w.projectiles.at(-1)!.power! > 1);
});
test('teams balance, allies are protected, and capture scoring requires an opponent', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'joinCombat', mode: 'capture' });
  advance(w, 10);
  assert.deepEqual(w.combat!.scores, [0, 0]);
  act(w, b.id, { type: 'joinCombat', mode: 'capture' });
  assert.notEqual(a.team, b.team);
  a.x = 0;
  a.z = -110;
  b.x = 150;
  b.z = -110;
  advance(w, 4);
  assert.ok(w.combat!.scores[0] > 0);
  b.team = a.team;
  b.x = a.x;
  b.z = a.z + 8;
  a.heading = 0;
  a.invulnerableUntil = b.invulnerableUntil = 0;
  act(w, a.id, { type: 'fire', weapon: 'machine' });
  advance(w, 0.15);
  assert.equal(b.health, 60000);
});
test('fighting disabled cancels in-flight weapons and mines cannot detonate at deployment', () => {
  const { w, a, b } = setup();
  b.x = a.x;
  b.z = a.z;
  act(w, a.id, { type: 'fire', weapon: 'mine' });
  advance(w, 0.1);
  assert.equal(b.health, 60000);
  w.settings.fighting = false;
  advance(w, 2);
  assert.equal(b.health, 60000);
  assert.equal(w.projectiles.length, 0);
});
test('flags require your own flag home; disconnect and leave drop possession', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'joinCombat', mode: 'ctf' });
  act(w, b.id, { type: 'joinCombat', mode: 'ctf' });
  a.x = 100;
  a.z = -110;
  b.x = 30;
  b.z = -110;
  advance(w, 0.1);
  assert.equal(w.combat!.flags[1].carrier, a.id);
  a.x = -100;
  advance(w, 0.1);
  assert.equal(w.combat!.scores[0], 1);
  assert.equal(w.combat!.flags[1].carrier, undefined);
  a.x = 100;
  advance(w, 0.1);
  act(w, a.id, { type: 'leaveGame' });
  assert.equal(w.combat!.flags[1].carrier, undefined);
  assert.equal(w.combat!.flags[1].dropped, w.time);
});
test('ordnance is isolated from later activity changes and a round rewards only once', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'fire', weapon: 'rocket' });
  act(w, a.id, { type: 'joinCombat', mode: 'deathmatch' });
  advance(w, 0.1);
  assert.equal(w.projectiles.length, 0);
  act(w, b.id, { type: 'joinCombat', mode: 'deathmatch' });
  w.combat!.scores = [10, 0];
  advance(w, 0.1);
  const kudos = a.kudos;
  advance(w, 1);
  assert.equal(a.kudos, kudos);
  assert.throws(() => act(w, a.id, { type: 'fire', weapon: 'machine' }), /next round/);
});

test('a round cannot cross even a thin safe-zone boundary between integration steps', () => {
  const { w, a, b } = setup();
  w.zones.push({ id: 'thin', kind: 'safe', x: 100, z: -49.2, radius: 0.1 });
  act(w, a.id, { type: 'fire', weapon: 'machine' });
  advance(w, 0.2);
  assert.equal(b.health, 60000);
  assert.equal(w.projectiles.length, 0);
});

test('leaving via town reset drops a flag; drone and aerial objective exploits are rejected', () => {
  const { w, a, b } = setup();
  act(w, a.id, { type: 'joinCombat', mode: 'ctf' });
  act(w, b.id, { type: 'joinCombat', mode: 'ctf' });
  a.x = 100;
  a.z = -110;
  b.x = 30;
  b.z = -110;
  advance(w, 0.1);
  assert.equal(w.combat!.flags[1].carrier, a.id);
  act(w, a.id, { type: 'respawn' });
  assert.equal(a.game, undefined);
  assert.equal(w.combat!.flags[1].carrier, undefined);
  act(w, a.id, { type: 'joinCombat', mode: 'ctf' });
  assert.throws(() => act(w, a.id, { type: 'crow' }), /combat/i);
  w.combat!.mode = 'capture';
  a.x = 0;
  a.z = -110;
  a.y = 30;
  advance(w, 1);
  assert.equal(w.combat!.scores[0], 0);
});

test('a new weapon press restarts an abandoned charge rather than inheriting its power', () => {
  const { w, a } = setup();
  act(w, a.id, { type: 'chargeWeapon', weapon: 'javelin' });
  advance(w, 2);
  act(w, a.id, { type: 'chargeWeapon', weapon: 'javelin' });
  act(w, a.id, { type: 'fire', weapon: 'javelin' });
  assert.equal(w.projectiles.at(-1)!.power, 0.5);
});
