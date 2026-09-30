// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
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
  assert.equal(p.tractorPaint, 'plum');
  assert.equal(p.cash, cash - 2500);
  assert.throws(() => act(w, p.id, { type: 'paint', building: g.id, color: 'plum' }));
  assert.equal(p.cash, cash - 2500);
});
test('home and workplace smoke depends on live occupancy and active, present staff', () => {
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
  assert.equal(h.smoking, false);
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
