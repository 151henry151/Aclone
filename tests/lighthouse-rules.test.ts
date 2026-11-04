// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  makeBuilding,
  act,
  advance,
  command,
} from '../src/shared/simulation';
import { Store } from '../src/server/store';
function setup() {
  const w = createWorld('keeper-rules', 'Keeper rules', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    other = addPlayer(w, 'other', 'Other'),
    b = makeBuilding('light', 'lighthouse', 0, 0);
  w.buildings = [b];
  w.towns = [];
  w.script = '';
  b.owner = p.id;
  b.investment = 0;
  Object.assign(w.settings, {
    activeWork: false,
    hungerRate: 0,
    thirstRate: 0,
    wageTax: 0,
    dayLength: 60,
  });
  Object.assign(p, { x: 0, z: 0 });
  Object.assign(other, { x: 0, z: 0 });
  const edit = (patch: Record<string, unknown>) => act(w, p.id, { type: 'settings', patch });
  const hire = () => act(w, p.id, { type: 'job', building: b.id });
  const pay = () => {
    const cash = p.cash;
    advance(w, 60);
    return p.cash - cash;
  };
  return { w, p, other, b, edit, hire, pay };
}
test('keeper wage cap defaults and missing fields preserve daily pay and owner allowance', () => {
  const { w, b, hire, pay } = setup();
  assert.equal((w.settings as any).lighthouseWageCap, 800);
  delete (w.settings as any).lighthouseWageCap;
  hire();
  assert.equal(pay(), 800);
  assert.equal(b.investment, 400);
});
test('lower higher and zero caps apply to admin, wages, commands and tax without changing posted rates', () => {
  const { w, p, b, edit, hire, pay } = setup();
  edit({ lighthouseWageCap: 321 });
  hire();
  assert.equal(b.wage, 800);
  assert.match(command(w, p, '*jobs'), /3\.21d/);
  assert.equal(pay(), 321);
  edit({ lighthouseWageCap: 2000 });
  assert.equal(pay(), 800);
  act(w, p.id, { type: 'buildingAdmin', building: b.id, wage: 1500 });
  assert.equal(b.wage, 1500);
  assert.equal(pay(), 1500);
  w.settings.wageTax = 0.1;
  edit({ lighthouseWageCap: 333 });
  assert.equal(pay(), 300);
  assert.equal(b.wage, 1500);
  act(w, p.id, { type: 'buildingAdmin', building: b.id, wage: 2000 });
  assert.equal(b.wage, 333);
  edit({ lighthouseWageCap: 0 });
  assert.equal(pay(), 0);
  assert.equal(p.job, b.id);
  assert.ok(b.lodging?.guests[p.id]);
  assert.match(command(w, p, '*jobs'), /0d/);
  assert.equal(b.investment, 2000);
});
test('cap respects empty and inactive keeper jobs, full-job refusal and ordinary wages', () => {
  const { w, p, other, b, edit, hire, pay } = setup();
  edit({ lighthouseWageCap: 1234 });
  assert.equal(pay(), 0);
  hire();
  const before = JSON.stringify(w);
  assert.throws(() => act(w, other.id, { type: 'job', building: b.id }), /All jobs filled/);
  assert.equal(JSON.stringify(w), before);
  w.settings.activeWork = true;
  p.activeUntil = w.time;
  assert.equal(pay(), 0);
  const mill = makeBuilding('mill', 'mill', 0, 0);
  mill.owner = p.id;
  w.buildings.push(mill);
  act(w, p.id, { type: 'buildingAdmin', building: mill.id, wage: 4321 });
  assert.equal(mill.wage, 4321);
});
test('keeper cap validates atomically and persists in creation, summaries and designs', async () => {
  const { w, p, b, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  assert.ok(settingsFields().includes('name="lighthouseWageCap"'));
  for (const n of [-1, 1.5, 1000001]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit({ lighthouseWageCap: n }));
    assert.equal(JSON.stringify(w), before);
  }
  edit({ lighthouseWageCap: 4321 });
  assert.match(rulesSummary(w), /4321/);
  const dest = createWorld('dest', 'Dest', 'owner');
  applyDesign(dest, exportDesign(w));
  assert.equal((dest.settings as any).lighthouseWageCap, 4321);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    assert.equal((loaded.settings as any).lighthouseWageCap, 4321);
    assert.equal(loaded.buildings.find((v) => v.id === b.id)!.wage, b.wage);
  } finally {
    store.close();
  }
});
test('resident observations quote the effective keeper wage and its live cap', async () => {
  const { w, p, b, edit } = setup();
  edit({ lighthouseWageCap: 321 });
  const { NpcMemory } = await import('../src/server/npc/memory'),
    { observe } = await import('../src/server/npc/observation');
  const store = new Store(':memory:');
  try {
    const state = {
      playerId: p.id,
      world: w.id,
      name: p.name,
      personality: 'Helpful',
      notebook: '',
      intent: 'Find work',
      cursor: 0,
      nextAt: 0,
      plan: [],
      index: 0,
      repeats: 0,
      until: 0,
      waitUntil: 0,
      status: 'Ready',
      errors: 0,
    };
    const observed = observe(w, p, state, new NpcMemory(store), 'keeper');
    assert.equal(observed.nearbyBuildings.find((v) => v.id === b.id)!.wage, 321);
    assert.equal((observed.worldRules as any).lighthouseWageCap, 321);
  } finally {
    store.close();
  }
});
test('keeper hiring and renewal stay visible for owners without exposing ordinary owner jobs', async () => {
  const { w, p, other, b } = setup(),
    { actionVisible, actionBlocker } = await import('../src/client/action-visibility');
  assert.equal(actionVisible(w, p, 'job', undefined, b), true, 'lighthouse owner may apply');
  act(w, p.id, { type: 'job', building: b.id });
  assert.equal(actionVisible(w, p, 'job', undefined, b), true, 'existing keeper may renew');
  assert.equal(
    actionVisible(w, other, 'job', undefined, b),
    true,
    'filled job remains visible with reason',
  );
  assert.match(actionBlocker(w, other, 'job', undefined, b)!, /All jobs filled/);
  p.job = 'other';
  assert.equal(actionVisible(w, p, 'job', undefined, b), false);
  delete p.job;
  const mill = makeBuilding('mill', 'mill', 0, 0);
  mill.owner = p.id;
  assert.equal(actionVisible(w, p, 'job', undefined, mill), false);
  w.settings.jobsEnabled = false;
  assert.equal(actionVisible(w, p, 'job', undefined, b), false);
});
