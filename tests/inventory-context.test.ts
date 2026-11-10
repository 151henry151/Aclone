// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding } from '../src/shared/simulation';
import { springPanel } from '../src/client/spring-panel';
import { canoePanel } from '../src/client/canoe-panel';
import { CANOE } from '../src/shared/canoe-rules';
const setup = () => {
  const w = createWorld('inventory', 'Inventory', 'p'),
    p = addPlayer(w, 'p', 'Pilot');
  w.buildings = [];
  w.springs = [];
  w.smallCraft = {};
  Object.assign(p, { x: 0, z: 0, vehicle: 5, inventory: {}, speed: 0 });
  return { w, p };
};
test('inventory hides unavailable springs and follows the configured interaction range', () => {
  const { w, p } = setup();
  assert.doesNotMatch(springPanel(w, p, true), /<h3>|<button/);
  w.springs = [{ id: 'water', x: 8, z: 0, flow: 1 }];
  assert.doesNotMatch(springPanel(w, p, true), /<h3>|<button/);
  w.settings.springDrinkRange = 8;
  assert.match(springPanel(w, p, true), /Drink from the spring/);
  p.lastSpringDrink = w.time;
  assert.match(springPanel(w, p, true), /Wait .* seconds/);
  p.vehicle = 0;
  assert.match(springPanel(w, p, true), /Stop on foot/);
  w.settings.springDrinkingEnabled = false;
  assert.doesNotMatch(springPanel(w, p, true), /<h3>|<button/);
  // The Activities directory still explains disabled facilities.
  assert.match(springPanel(w, p), /disabled/);
});
test('inventory shows canoe controls only for a relevant hull or nearby service', () => {
  const { w, p } = setup();
  assert.doesNotMatch(canoePanel(w, p, true), /<h3>|<form/);
  p.inventory.canoe = 1;
  assert.match(canoePanel(w, p, true), /Lift inventory canoe/);
  delete p.inventory.canoe;
  w.smallCraft = {
    c: {
      id: 'c',
      kind: 'canoe',
      paint: 'red',
      owner: p.id,
      x: 8,
      z: 0,
      heading: 0,
      state: 'setDown',
    },
  };
  assert.doesNotMatch(canoePanel(w, p, true), /<h3>|<form/);
  w.settings.canoeRange = 8;
  assert.match(canoePanel(w, p, true), /Pick up canoe/);
  p.speed = 2;
  assert.match(canoePanel(w, p, true), /Stop on foot/);
  p.speed = 0;
  w.smallCraft = {};
  const home = makeBuilding('h', 'home', 0, 0);
  home.owner = p.id;
  home.stock = {};
  w.buildings = [home];
  assert.doesNotMatch(canoePanel(w, p, true), /<h3>|<form/);
  home.stock.canoe = 1;
  assert.match(canoePanel(w, p, true), /Take canoe out/);
  home.kind = 'carpenter';
  home.stock = {};
  assert.match(canoePanel(w, p, true), /Buy canoe/);
  home.construction = { progress: 0 } as any;
  assert.doesNotMatch(canoePanel(w, p, true), /<h3>|<form/);
  p.vehicle = CANOE;
  assert.match(canoePanel(w, p, true), /Beach canoe/);
});
