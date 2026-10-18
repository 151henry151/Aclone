// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation.ts';
import {
  constructionBudget,
  constructionChoices,
} from '../src/server/npc/construction-projects.ts';
import { operationAction } from '../src/server/npc/player-operations.ts';
import { startCareer, continueCareer } from '../src/server/npc/projects.ts';
import { enterpriseChoices } from '../src/server/npc/enterprise.ts';
import type { ResidentState } from '../src/server/npc/memory.ts';

test('an accepted cottage project buys and delivers materials across separate legs and a saved state', () => {
  const w = createWorld('build', 'Build', 'server'),
    p = addPlayer(w, 'builder', 'Builder');
  p.cash = 1000000;
  p.inventory = { bread: 3, water: 6 };
  p.x = -90;
  p.z = -130;
  const budget = constructionBudget(w, p, 'home', p);
  assert.ok(budget && budget.materialCost > 0 && budget.living > 0);
  act(w, p.id, { type: 'construct', kind: 'home' });
  const b = w.buildings.at(-1)!;
  let state = { plan: [], index: 0 } as unknown as ResidentState;
  startCareer(w, p, state, { kind: 'housing', target: b.id });
  let legs = 0;
  while (b.construction && legs++ < 30) {
    const choice = continueCareer(w, p, state, enterpriseChoices(w, p));
    assert.ok(choice, 'construction must have a costed next leg');
    for (const s of choice.plan) {
      if (s.kind === 'travel') {
        const target = w.buildings.find((v) => v.id === s.destination)!;
        p.x = target.x;
        p.z = target.z;
      } else if (s.kind === 'act') act(w, p.id, s.action);
      else if (s.kind === 'operation') act(w, p.id, operationAction(s));
    }
    state = JSON.parse(JSON.stringify(state));
  }
  assert.ok(!b.construction, 'all materials delivered; finished cottage');
  assert.ok(legs > 1);
  assert.ok(p.cash > 1000000 - budget!.total);
});

test('construction refuses unknown material supplies and protects meal money during procurement', () => {
  const w = createWorld('build', 'Build', 'server'),
    p = addPlayer(w, 'builder', 'Builder');
  p.cash = 1000000;
  p.x = -90;
  p.z = -130;
  act(w, p.id, { type: 'construct', kind: 'home' });
  p.inventory = {};
  p.cash = 1;
  assert.deepEqual(constructionChoices(w, p), []);
  for (const b of w.buildings) {
    b.stock = {};
  }
  assert.equal(constructionBudget(w, p, 'home', { x: -90, z: -110 }), undefined);
});
