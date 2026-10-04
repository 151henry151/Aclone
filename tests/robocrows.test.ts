// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, move } from '../src/shared/simulation.ts';
import { tickCombat } from '../src/shared/combat.ts';
function fixture() {
  const w = createWorld('crows', 'Crows', 'owner', 'combat');
  w.script = '';
  w.zones = [];
  w.buildings = [];
  w.settings.crowAbilities = true;
  w.settings.fighting = true;
  const p = addPlayer(w, 'p', 'Pilot');
  p.online = true;
  p.x = p.z = 0;
  p.heading = 0;
  p.inventory.rc = 4;
  return { w, p };
}
test('crow classes limit weapons and forbid economic transport or team-match escape', () => {
  const { w, p } = fixture();
  act(w, p.id, { type: 'crow', class: 'scout' });
  assert.throws(() => act(w, p.id, { type: 'fire', weapon: 'machine' }), /cannot use/);
  assert.throws(() => act(w, p.id, { type: 'trade', item: 'wheat' }), /Return/);
  act(w, p.id, { type: 'crow' });
  assert.equal(p.vehicle, 0);
  act(w, p.id, { type: 'crow', class: 'interceptor' });
  assert.throws(() => act(w, p.id, { type: 'fire', weapon: 'rocket' }), /cannot use/);
  act(w, p.id, { type: 'fire', weapon: 'machine' });
  assert.equal(w.projectiles.length, 1);
  act(w, p.id, { type: 'crow' });
  p.game = 'combat';
  assert.throws(() => act(w, p.id, { type: 'crow' }), /combat/);
  delete p.game;
  w.settings.crowAbilities = false;
  assert.throws(() => act(w, p.id, { type: 'crow', class: 'bomber' }), /disabled/);
  act(w, p.id, { type: 'crow' });
  assert.equal(p.crowClass, undefined);
});
test('mark and recall move only the drone, spend energy and enforce cooldown', () => {
  const { w, p } = fixture();
  act(w, p.id, { type: 'crow' });
  p.x = 30;
  p.z = 40;
  act(w, p.id, { type: 'crowAbility', operation: 'mark' });
  p.x = 90;
  p.z = 90;
  const before = p.energy;
  act(w, p.id, { type: 'crowAbility', operation: 'recall' });
  assert.equal(p.x, 30);
  assert.equal(p.energy, before - 25000);
  assert.throws(() => act(w, p.id, { type: 'crowAbility', operation: 'recall' }), /cooling/);
  assert.deepEqual(p.crowBody, { x: 0, z: 0, vehicle: 0 });
  act(w, p.id, { type: 'crow' });
  assert.equal(p.x, 0);
  assert.equal(p.crowMark, undefined);
  assert.equal(p.vehicle, 0);
});
test('destroying a drone returns its pilot without killing them or minting kill rewards', () => {
  const { w, p } = fixture(),
    q = addPlayer(w, 'q', 'Target');
  q.online = true;
  q.x = 0;
  q.z = 10;
  q.inventory.rc = 1;
  act(w, q.id, { type: 'crow', class: 'bomber' });
  q.crowIntegrity = 1;
  act(w, p.id, { type: 'crow', class: 'interceptor' });
  p.y = q.y;
  p.heading = 0;
  const cash = p.cash,
    health = q.health;
  act(w, p.id, { type: 'fire', weapon: 'machine' });
  tickCombat(w, 1, () => assert.fail('Drone damage must not kill the pilot'));
  assert.equal(q.crowBody, undefined);
  assert.equal(q.health, health);
  assert.equal(p.cash, cash);
  assert.equal(p.kills, 0);
});
