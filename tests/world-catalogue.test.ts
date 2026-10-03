// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance, carry } from '../src/shared/simulation.ts';
import {
  worldItems,
  worldSkills,
  setCatalogue,
  productionDiagnostics,
} from '../src/shared/world-catalogue.ts';
import { exportDesign, applyDesign } from '../src/server/world-design.ts';
import { defaultCreator } from '../src/shared/creator.ts';
function fixture() {
  const w = createWorld('catalogue', 'Catalogue', 'owner'),
    p = addPlayer(w, 'owner', 'Owner');
  p.cash = 1000000;
  p.online = true;
  w.creator = defaultCreator();
  setCatalogue(w, p, {
    items: {
      'custom:tea': { name: 'Mountain tea', icon: '🍵', weight: 3, price: 1200, drink: 12000 },
    },
    skills: {
      'custom:blender': {
        name: 'Tea blending',
        price: 1234,
        seconds: 2,
        prerequisites: ['miller'],
      },
    },
  });
  return { w, p };
}
test('catalogues stay world-local and custom trades obey capacity and consumption', () => {
  const { w, p } = fixture();
  const other = createWorld('other', 'Other', 'owner');
  assert.equal(worldItems(w)['custom:tea'].name, 'Mountain tea');
  assert.equal(worldItems(other)['custom:tea'], undefined);
  const b = w.buildings.find((b) => b.kind === 'market')!;
  b.sell['custom:tea'] = 1300;
  b.stock['custom:tea'] = 100;
  p.x = b.x;
  p.z = b.z;
  p.inventory = {};
  act(w, p.id, {
    type: 'trade',
    building: b.id,
    item: 'custom:tea',
    direction: 'buy',
    quantity: 3,
  });
  assert.equal(carry(p, w), 9);
  p.thirst = 20000;
  act(w, p.id, { type: 'use', item: 'custom:tea' });
  assert.equal(p.thirst, 8000);
  assert.throws(
    () =>
      act(w, p.id, {
        type: 'trade',
        building: b.id,
        item: 'custom:tea',
        direction: 'buy',
        quantity: 60,
      }),
    /cargo/i,
  );
  assert.throws(() => setCatalogue(w, p, { items: {}, skills: {} }), /used|referenced/i);
});
test('custom professions require prerequisites and control tuition/time and production', () => {
  const { w, p } = fixture(),
    school = w.buildings.find((b) => b.kind === 'school')!;
  p.x = school.x;
  p.z = school.z;
  assert.ok(worldSkills(w).includes('custom:blender'));
  assert.throws(
    () => act(w, p.id, { type: 'learn', building: school.id, skill: 'custom:blender' }),
    /miller|prerequisite/i,
  );
  p.skills = ['miller'];
  const cash = p.cash;
  act(w, p.id, { type: 'learn', building: school.id, skill: 'custom:blender' });
  assert.equal(p.cash, cash - 1234);
  advance(w, 2);
  assert.ok(p.skills.includes('custom:blender'));
  const b = w.buildings.find((b) => b.kind === 'mill')!;
  p.x = b.x;
  p.z = b.z;
  act(w, p.id, {
    type: 'creatorRecipe',
    building: b.id,
    recipe: {
      inputs: { water: 1 },
      outputs: { 'custom:tea': 2 },
      skill: 'custom:blender',
      seconds: 10,
    },
  });
  b.stock = { water: 4 };
  b.investment = 100000;
  b.wage = 100;
  b.buy.water = 200;
  b.sell['custom:tea'] = 1200;
  act(w, p.id, { type: 'job', building: b.id });
  advance(w, 10);
  assert.equal(b.stock['custom:tea'], 2);
  const diagnostics = productionDiagnostics(w, b);
  assert.equal(diagnostics.outputValue, 2400);
  assert.ok(diagnostics.margin > 0);
});
test('invalid references/cyclic prerequisites reject atomically and designs retain definitions', () => {
  const { w, p } = fixture();
  const before = structuredClone(w.catalogue);
  assert.throws(
    () =>
      setCatalogue(w, p, {
        items: {},
        skills: {
          'custom:a': { name: 'A', price: 1, seconds: 1, prerequisites: ['custom:b'] },
          'custom:b': { name: 'B', price: 1, seconds: 1, prerequisites: ['custom:a'] },
        },
      }),
    /cycle/i,
  );
  assert.deepEqual(w.catalogue, before);
  assert.throws(
    () =>
      setCatalogue(w, p, {
        items: { water: { name: 'Override', weight: 0, price: 0 } },
        skills: {},
      }),
    /custom|Invalid/i,
  );
  const target = createWorld('copy', 'Copy', 'owner');
  applyDesign(target, exportDesign(w));
  assert.equal(worldItems(target)['custom:tea'].price, 1200);
});

test('building templates copy economics and preserve ordinary construction and shoreline rules', () => {
  const { w, p } = fixture();
  setCatalogue(w, p, {
    ...w.catalogue,
    templates: {
      'custom:tea_house': {
        name: 'Tea house',
        base: 'mill',
        price: 1000,
        wage: 400,
        materials: { wood: 2 },
        buy: { water: 500 },
        sell: { 'custom:tea': 1500 },
        production: {
          inputs: { water: 1 },
          outputs: { 'custom:tea': 2 },
          skill: 'custom:blender',
          seconds: 10,
        },
      },
    },
  });
  p.x = 210;
  p.z = -220;
  act(w, p.id, { type: 'construct', kind: 'custom:tea_house' });
  const b = w.buildings.find((b) => b.templateId === 'custom:tea_house')!;
  assert.equal(b.kind, 'mill');
  assert.equal(b.name, 'Tea house');
  assert.equal(b.sell['custom:tea'], 1500);
  assert.deepEqual(b.construction, { wood: 2 });
  p.inventory.wood = 2;
  act(w, p.id, { type: 'supply', building: b.id });
  assert.equal(b.construction, undefined);
  assert.throws(() => setCatalogue(w, p, { ...w.catalogue, templates: {} }), /still used/);
  const copy = createWorld('copied', 'Copied', 'owner');
  applyDesign(copy, exportDesign(w));
  assert.equal(copy.buildings.find((x) => x.id === b.id)?.templateId, 'custom:tea_house');
});

test('custom supplies feed sheltered offline players and production diagnostics expose shortages', () => {
  const { w, p } = fixture();
  const home = w.buildings.find((b) => b.kind === 'home')!;
  home.owner = p.id;
  home.stock = { 'custom:tea': 10 };
  p.home = home.id;
  p.atHome = true;
  p.online = false;
  p.thirst = 40000;
  const before = home.stock['custom:tea'];
  advance(w, 1);
  assert.ok(home.stock['custom:tea'] < before);
  assert.ok(p.thirst < 40000);
  const mill = w.buildings.find((b) => b.kind === 'mill')!;
  mill.production = {
    inputs: { 'custom:tea': 3 },
    outputs: { water: 1 },
    skill: 'custom:blender',
    seconds: 10,
    tier: 0,
  };
  mill.buy['custom:tea'] = 1500;
  mill.sell.water = 100;
  const d = productionDiagnostics(w, mill);
  assert.ok(d.margin < 0);
  assert.deepEqual(d.inputs[0].suppliers, []);
});
