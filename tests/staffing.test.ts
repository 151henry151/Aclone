// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance } from '../src/shared/simulation.ts';
import { productionEfficiency, productionStaffing } from '../src/shared/sound-state.ts';
import { idealEmployees } from '../src/shared/staffing.ts';
import { catalogueSchema } from '../src/shared/world-catalogue.ts';
import { publicBuildings } from '../src/server/snapshots.ts';
import { usefulShift } from '../src/server/npc/business-policy.ts';
import { workplace } from '../src/server/npc/workplace.ts';

function fixture() {
  const w = createWorld('test', 'Test', 'server');
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  b.government = false;
  b.stock = { wheat: 100, flour: 0 };
  b.investment = 1000000;
  b.progress = 0;
  w.settings.hungerRate = w.settings.thirstRate = 0;
  const crew = Array.from({ length: 4 }, (_, i) => addPlayer(w, 'worker' + i, 'Worker ' + i));
  for (const p of crew) {
    p.job = b.id;
    p.skills = ['miller'];
    p.activeUntil = 100000;
  }
  return { w, b, crew };
}

test('staffing peaks at the ideal and drops on both sides, including large crews', () => {
  const { w, b } = fixture();
  assert.equal(idealEmployees(w, b), 2);
  for (const [staff, expected] of [
    [0, 0.01],
    [1, 0.5],
    [2, 1],
    [3, 2 / 3],
    [4, 0.5],
    [16, 0.125],
  ])
    assert.equal(productionEfficiency(w, b, staff), expected);
});

test('fractional staffing changes batch timing, carries progress and pays only completed batches', () => {
  for (const [workers, first, second] of [
    [1, 0, 3],
    [2, 3, 6],
    [4, 0, 3],
  ]) {
    const { w, b, crew } = fixture();
    b.employees = crew.slice(0, workers).map((p) => p.id);
    const cash = b.investment;
    advance(w, 600);
    assert.equal(b.stock.flour, first);
    advance(w, 600);
    assert.equal(b.stock.flour, second);
    assert.equal(b.investment, cash - (second / 3) * b.wage * workers);
    assert.equal(b.stock.wheat, 100 - (second / 3) * 5);
  }
});

test('snapshot, workplace and NPC shift selection share active rather than hired staffing', () => {
  const { w, b, crew } = fixture();
  b.employees = crew.map((p) => p.id);
  crew[2].activeUntil = crew[3].activeUntil = -1;
  assert.equal(productionStaffing(w, b).active, 2);
  assert.equal(publicBuildings(w).find((x) => x.id === b.id)!.staffing!.ideal, 2);
  assert.equal(workplace(w, crew[0], b)!.efficiencyNextCycle, 1);
  assert.equal(usefulShift(w, crew[2], b), false);
  assert.equal(usefulShift(w, crew[0], b), true);
  crew[2].activeUntil = 100000;
  assert.equal(usefulShift(w, crew[0], b), true, 'keep the first useful worker');
  assert.equal(usefulShift(w, crew[1], b), true, 'keep the second useful worker');
  assert.equal(usefulShift(w, crew[2], b), false, 'excess worker should not renew');
  crew[2].activeUntil = -1;
  crew[1].activeUntil = -1;
  assert.equal(usefulShift(w, crew[2], b), true);
  assert.equal(workplace(w, crew[0], b)!.efficiencyNextCycle, 0.5);
});

test('owner operation counts as one worker; unattended public operation stays available', () => {
  const { w, b, crew } = fixture();
  b.owner = crew[0].id;
  w.settings.ownerOperation = true;
  b.ownerActiveUntil = 10000;
  assert.equal(productionEfficiency(w, b), 0.5);
  b.employees = [crew[1].id];
  assert.equal(productionEfficiency(w, b), 1);
  b.ownerActiveUntil = -1;
  assert.equal(productionEfficiency(w, b), 0.5);
  b.employees = [];
  b.government = true;
  assert.equal(productionEfficiency(w, b), 1);
  b.employees = crew.slice(1).map((p) => p.id);
  assert.equal(productionEfficiency(w, b), 2 / 3);
});

test('custom templates set ideal crew sizes and reject impossible values', () => {
  const { w, b } = fixture();
  const t = {
    name: 'Team mill',
    base: 'mill',
    price: 100,
    wage: 10,
    materials: {},
    idealEmployees: 3,
  };
  w.catalogue = catalogueSchema.parse({ templates: { 'custom:team': t } });
  b.templateId = 'custom:team';
  assert.equal(idealEmployees(w, b), 3);
  assert.equal(productionEfficiency(w, b, 1), 1 / 3);
  assert.equal(productionEfficiency(w, b, 3), 1);
  for (const idealEmployees of [0, 17, 2.5])
    assert.throws(() =>
      catalogueSchema.parse({ templates: { 'custom:team': { ...t, idealEmployees } } }),
    );
});

test('non-binary efficiency preserves batch counts and progress across saves and tick sizes', () => {
  const { w, b, crew } = fixture();
  for (let i = 4; i < 7; i++) {
    const p = addPlayer(w, 'worker' + i, 'Worker ' + i);
    p.activeUntil = 100000;
    crew.push(p);
  }
  b.employees = crew.map((p) => p.id);
  advance(w, 600);
  const restored = structuredClone(w);
  advance(w, 3600);
  for (let i = 0; i < 360; i++) advance(restored, 10);
  assert.equal(b.stock.flour, 6);
  assert.equal(restored.buildings.find((x) => x.id === b.id)!.stock.flour, 6);
  assert.ok(b.progress < 1e-8);
});
