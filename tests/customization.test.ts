// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
import { vehiclePaint } from '../src/shared/appearance.ts';
import { Store } from '../src/server/store.ts';
import { prepareFrame } from '../src/server/snapshots.ts';
import { buildingPlan } from '../src/shared/building-shapes.ts';

test('cottage styles persist at construction and invalid styling never charges cash', () => {
  const w = createWorld('t', 'Test', 'p'),
    p = addPlayer(w, 'p', 'Painter');
  p.x = 160;
  p.z = 0;
  p.cash = 1000000;
  const before = p.cash;
  assert.throws(() => act(w, p.id, { type: 'construct', kind: 'home', style: 'unknown' }));
  assert.equal(p.cash, before);
  act(w, p.id, { type: 'construct', kind: 'home', style: 'white-clapboard' });
  const b = w.buildings.at(-1)!;
  assert.equal(b.style, 'white-clapboard');
  assert.equal(buildingPlan(b).siding, 'wood');
  assert.equal(JSON.parse(JSON.stringify(b)).style, b.style);
});
test('garage repaint validates proximity, costs money once and broadcasts a safe palette key', () => {
  const w = createWorld('t', 'Test', 'p'),
    p = addPlayer(w, 'p', 'Painter');
  const g = w.buildings.find((b) => b.kind === 'garage')!;
  const cash = p.cash;
  assert.throws(() => act(w, p.id, { type: 'paint', building: g.id, color: 'plum' }));
  assert.equal(p.cash, cash);
  p.x = g.x;
  p.z = g.z;
  assert.throws(() => act(w, p.id, { type: 'paint', building: g.id, color: '<script>' }));
  act(w, p.id, { type: 'paint', building: g.id, color: 'plum' });
  assert.equal(p.vehiclePaints?.[0], 'plum');
  assert.equal(p.cash, cash - 2500);
  assert.throws(() => act(w, p.id, { type: 'paint', building: g.id, color: 'plum' }));
  assert.equal(p.cash, cash - 2500);
});
test('home and workplace smoke depends on saved occupancy and active, present staff', () => {
  const w = createWorld('t', 'Test', 'p'),
    p = addPlayer(w, 'p', 'Resident');
  const h = w.buildings.find((b) => b.kind === 'home')!,
    m = w.buildings.find((b) => b.kind === 'mill')!;
  h.owner = p.id;
  p.home = h.id;
  p.atHome = true;
  p.online = true;
  advance(w, 0.05);
  assert.equal(h.smoking, true);
  assert.equal(m.smoking, false);
  p.online = false;
  advance(w, 0.05);
  assert.equal(h.smoking, true);
  p.online = true;
  p.atHome = false;
  p.job = m.id;
  p.activeUntil = w.time + 600;
  p.x = m.x;
  p.z = m.z;
  m.employees = [p.id];
  advance(w, 0.05);
  assert.equal(m.smoking, true);
  p.x = 150;
  advance(w, 0.05);
  assert.equal(m.smoking, false);
});

test('smoke pool stays bounded and clears particles when worlds change', async () => {
  const { SmokePlumes } = await import('../src/client/smoke.ts');
  const { Vector3 } = await import('three');
  const smoke = new SmokePlumes(8);
  for (let i = 0; i < 100; i++) smoke.emit(new Vector3(i, 0, 0));
  smoke.update(0.5);
  assert.equal(smoke.mesh.geometry.attributes.position.count, 8);
  assert.ok([...smoke.mesh.geometry.attributes.opacity.array].some((n) => n > 0));
  smoke.clear();
  smoke.update(0.1);
  assert.ok([...smoke.mesh.geometry.attributes.opacity.array].every((n) => n === 0));
  smoke.mesh.geometry.dispose();
  (smoke.mesh.material as import('three').Material).dispose();
});

test('individual vehicle finishes preserve old owned paints, isolate repaints and survive reload', () => {
  const w = createWorld('paints', 'Paints', 'p'),
    p = addPlayer(w, 'p', 'Painter');
  p.online = true;
  p.cash = 1000000;
  p.fleet = [0, 5, 24];
  p.tractorPaint = 'blue';
  const g = w.buildings.find((b) => b.kind === 'garage')!;
  p.x = g.x;
  p.z = g.z;
  assert.equal(vehiclePaint(p, 24), 'blue');
  act(w, p.id, { type: 'vehicle', slot: 28, building: g.id });
  assert.deepEqual(p.vehiclePaints, { 0: 'blue', 24: 'blue' });
  assert.equal(vehiclePaint(p), undefined, 'newly purchased machine has its factory finish');
  act(w, p.id, { type: 'paint', slot: 28, building: g.id, color: 'plum' });
  act(w, p.id, { type: 'paint', slot: 24, building: g.id, color: 'moss' });
  assert.equal(p.vehicle, 28, 'painting a parked machine must not switch vehicles');
  assert.equal(vehiclePaint(p), 'plum');
  assert.deepEqual(p.vehiclePaints, { 0: 'blue', 24: 'moss', 28: 'plum' });
  const publicPlayer = JSON.parse(prepareFrame(w).players[p.id]);
  assert.equal(publicPlayer.tractorPaint, 'plum');
  assert.equal(
    publicPlayer.vehiclePaints,
    undefined,
    'do not reveal the parked fleet to other players',
  );
  assert.equal(vehiclePaint(publicPlayer), 'plum', 'remote clients resolve the visible finish');
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    const q = restored.players[p.id];
    assert.deepEqual(q.vehiclePaints, p.vehiclePaints);
    act(restored, q.id, { type: 'vehicle', slot: 24 });
    assert.equal(vehiclePaint(q), 'moss');
    act(restored, q.id, { type: 'vehicle', slot: 0 });
    assert.equal(vehiclePaint(q), 'blue');
  } finally {
    store.close();
  }
});

test('repainting migrates only once, validates ownership and palette before charging', () => {
  const w = createWorld('paint-guards', 'Paint guards', 'p'),
    p = addPlayer(w, 'p', 'Painter');
  const g = w.buildings.find((b) => b.kind === 'garage')!;
  p.x = g.x;
  p.z = g.z;
  p.cash = 100000;
  p.fleet = [0, 5, 24, 28];
  p.tractorPaint = 'blue';
  act(w, p.id, { type: 'paint', slot: 24, building: g.id, color: 'plum' });
  assert.deepEqual(p.vehiclePaints, { 0: 'blue', 24: 'plum', 28: 'blue' });
  assert.equal(p.tractorPaint, undefined);
  for (const action of [
    { slot: 25, color: 'moss' },
    { slot: 5, color: 'moss' },
    { slot: -1, color: 'moss' },
    { slot: 999, color: 'moss' },
    { slot: 24.5, color: 'moss' },
    { slot: 24, color: '<script>' },
    { slot: 24, color: 'plum' },
  ]) {
    const before = JSON.stringify(p);
    assert.throws(() => act(w, p.id, { type: 'paint', building: g.id, ...action }));
    assert.equal(JSON.stringify(p), before);
  }
  p.cash = 0;
  assert.throws(
    () => act(w, p.id, { type: 'paint', slot: 28, building: g.id, color: 'moss' }),
    /cash/,
  );
  assert.equal(vehiclePaint(p, 28), 'blue');
  p.cash = 100000;
  p.x += 100;
  assert.throws(() => act(w, p.id, { type: 'paint', slot: 28, building: g.id, color: 'moss' }));
  assert.equal(vehiclePaint(p, 28), 'blue');
});
