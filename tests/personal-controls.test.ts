import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { actionVisible } from '../src/client/action-visibility';
import { createHuman } from '../src/client/human';
import { createFlashlight } from '../src/client/flashlight';
import { LIFEBOAT, reboardReason } from '../src/shared/boat-rescue';
import { vehicles } from '../src/shared/catalog';

test('walking flashlight is usable; engines are unavailable on foot, creatures and rowing boats', () => {
  const w = createWorld('controls', 'Controls', 'p'),
    p = addPlayer(w, 'p', 'Pilot');
  for (const slot of [5, 6, 7, LIFEBOAT]) {
    p.vehicle = slot;
    assert.equal(actionVisible(w, p, 'engine'), false);
    assert.throws(() => act(w, p.id, { type: 'engine' }), /no motor/);
  }
  p.vehicle = 5;
  assert.equal(actionVisible(w, p, 'lights'), true);
  const before = p.lights;
  act(w, p.id, { type: 'lights' });
  assert.equal(p.lights, !before);
  p.vehicle = 0;
  assert.equal(actionVisible(w, p, 'engine'), true);
  assert.equal(vehicles[LIFEBOAT].capacity, 10);
});
test('torch follows the animated hand and its beam points ahead at walking scale', () => {
  const h = createHuman(),
    f = createFlashlight(h.group),
    a = new T.Vector3(),
    b = new T.Vector3();
  h.group.position.set(12, 3, 8);
  h.group.rotation.y = Math.PI / 2;
  h.animate(0.1, 0.033);
  f.update(true);
  f.muzzle.getWorldPosition(a);
  f.target.getWorldPosition(b);
  assert.equal(f.group.parent?.name, 'hand--1');
  assert.ok(a.y > 3.5 && a.y < 4.7);
  assert.ok(b.x > a.x + 15);
  f.update(false);
  assert.equal(f.group.visible, false);
});
test('reboard hint requires an eligible nearby stopped boat over water', () => {
  const w = createWorld('controls', 'Controls', 'p'),
    p = addPlayer(w, 'p', 'Pilot');
  w.terrain = [];
  w.settings.seaLevel = 100;
  p.vehicle = LIFEBOAT;
  p.speed = 0;
  p.x = 0;
  p.z = 0;
  w.boatRescues = {
    p: {
      boat: { x: 3, z: 0, heading: 0, paint: 'blue', slot: 3 },
      cargo: {},
      dinghy: { x: 0, z: 0, heading: 0, moored: false },
    },
  };
  assert.equal(reboardReason(w, p), undefined);
  p.x = 50;
  assert.match(reboardReason(w, p)!, /five metres/);
  assert.equal(actionVisible(w, p, 'lifeboat', 'reboard'), false);
  p.x = 0;
  p.vehicle = 5;
  assert.ok(reboardReason(w, p));
  p.vehicle = LIFEBOAT;
  p.speed = 1;
  assert.ok(reboardReason(w, p));
});
