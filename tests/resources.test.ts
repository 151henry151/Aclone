// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, advance, addPlayer, createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { resourceNodes, resourceAmount, gatheringStatus } from '../src/shared/resources.ts';
import { recipes, items, buildings, skills } from '../src/shared/catalog.ts';
test('gathering reserves finite nearby resources, completes offline and regenerates slowly', () => {
  const w = createWorld('r', 'Resources', 'p'),
    p = addPlayer(w, 'p', 'Digger'),
    n = resourceNodes.find((n) => n.item === 'dirt')!;
  assert.throws(() => act(w, p.id, { type: 'gather', node: n.id }));
  p.x = n.x;
  p.z = n.z;
  p.y = 0.15;
  const before = resourceAmount(w, n);
  act(w, p.id, { type: 'gather', node: n.id });
  assert.equal(resourceAmount(w, n), before - 3);
  assert.throws(() => act(w, p.id, { type: 'gather', node: n.id }));
  p.online = false;
  advance(w, 21);
  assert.equal(p.inventory.dirt, 3);
  assert.equal(p.task, undefined);
  const saved = JSON.parse(JSON.stringify(w));
  advance(saved, 1800);
  assert.equal(resourceAmount(saved, n), before);
});
test('all industry inputs, skills, construction and outputs form valid stocked production cycles', () => {
  for (const kind of [
    'composter',
    'brickworks',
    'concreteWorks',
    'carpenter',
    'winery',
    'kitchen',
    'teaHouse',
    'roastery',
  ]) {
    const w = createWorld('industry', 'Industry', 'p'),
      p = addPlayer(w, 'p', 'Worker'),
      b = makeBuilding('factory', kind, 0, 0),
      r = recipes[kind];
    assert.ok(skills.includes(r.skill));
    for (const key of [
      ...Object.keys(r.inputs),
      ...Object.keys(r.outputs),
      ...Object.keys(buildings[kind].materials),
    ])
      assert.ok(items[key], key);
    w.buildings = [b];
    b.stock = { ...r.inputs };
    b.employees = [p.id];
    p.job = b.id;
    p.activeUntil = r.seconds + 1;
    b.investment = b.wage;
    advance(w, r.seconds);
    for (const [key, n] of Object.entries(r.outputs)) assert.equal(b.stock[key], n, kind);
    assert.ok(b.investment === 0);
    const outputs = JSON.stringify(b.stock);
    advance(w, r.seconds);
    assert.equal(JSON.stringify(b.stock), outputs);
  }
});

test('gathering preview matches server requirements and skilled yields without mutating the world', () => {
  const w = createWorld('preview', 'Resources', 'p');
  const p = addPlayer(w, 'p', 'Gatherer');
  for (const item of ['logs', 'stone', 'gravel', 'dirt']) {
    const n = resourceNodes.find((n) => n.item === item)!;
    p.x = n.x;
    p.z = n.z;
    p.y = 0.15;
    p.inventory = {};
    p.skills = [];
    const before = JSON.stringify(w);
    const basic = gatheringStatus(w, p, n);
    assert.equal(basic.amount, 3);
    assert.equal(basic.seconds, 20);
    assert.equal(!!basic.reason, item !== 'dirt');
    assert.equal(JSON.stringify(w), before, 'HUD checks are read-only');
    p.inventory.tools = 1;
    assert.equal(gatheringStatus(w, p, n).reason, undefined);
    p.skills = [item === 'logs' ? 'forester' : 'excavator'];
    assert.equal(gatheringStatus(w, p, n).amount, 6);
    assert.equal(gatheringStatus(w, p, n).seconds, 12);
    p.inventory.logs = 999;
    assert.match(gatheringStatus(w, p, n).reason!, /cargo/i);
    p.inventory.logs = 0;
    w.resources ??= {};
    w.resources[n.id] = { amount: 0, updated: w.time };
    const reason = gatheringStatus(w, p, n).reason!;
    assert.match(reason, /replenish/);
    assert.throws(() => act(w, p.id, { type: 'gather', node: n.id }), { message: reason });
    delete w.resources[n.id];
    p.y += 10;
    assert.match(gatheringStatus(w, p, n).reason!, /close/);
  }
});
