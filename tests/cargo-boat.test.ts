// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vehicles } from '../src/shared/catalog';
import { CANOE } from '../src/shared/canoe-rules';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import {
  vehicleDef,
  hasProvisions,
  crewBerths,
  vehicleSlotSchema,
} from '../src/shared/vehicle-config';
import { throttleBoat } from '../src/shared/boats';
import { helmBlock } from '../src/shared/captain';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { vehicleEditor } from '../src/client/vehicle-editor';
const slot = 35;
test('coaster appends a configurable freight vessel without moving the canoe or legacy slots', () => {
  const w = createWorld('freight-definition', 'Freight', 'owner');
  assert.equal(CANOE, 34);
  assert.equal(vehicles[CANOE].name, 'Canoe');
  assert.equal(vehicles[slot]?.name, 'Coastal cargo boat');
  const v = vehicleDef(w, slot);
  assert.equal(v.mode, 3);
  assert.equal(v.length, 20);
  assert.equal(v.beam, 5.6);
  assert.equal(v.capacity, 60);
  assert.equal((v as any).holdCapacity, 2000);
  assert.equal((v as any).cargoKind, 'box');
  assert.equal(v.speed, 6);
  assert.equal(v.fuel, 0.008);
  assert.equal(v.tank, 320);
  assert.equal(v.price, 2400000);
  assert.ok(throttleBoat(slot, w));
  assert.ok(hasProvisions(slot, w));
  assert.equal(crewBerths(slot, w), 2);
  w.settings.requireCaptainSkill = true;
  assert.ok(helmBlock(w, slot, []));
  assert.equal(helmBlock(w, slot, ['captain']), undefined);
});
test('freight hold tuning is validated, exposed and portable with the existing vehicle catalogue', () => {
  const w = createWorld('freight-tuning', 'Freight', 'owner');
  addPlayer(w, 'owner', 'Builder');
  assert.ok(vehicleSlotSchema.safeParse(String(slot)).success);
  act(w, 'owner', {
    type: 'vehicleTuning',
    slot,
    holdCapacity: 1250,
    cargoKind: 'logs',
    speed: 4,
    tank: 900,
    price: 1800000,
  });
  const v = vehicleDef(w, slot);
  assert.equal((v as any).holdCapacity, 1250);
  assert.equal((v as any).cargoKind, 'logs');
  assert.equal(v.speed, 4);
  const before = structuredClone(w.vehicleTuning);
  assert.throws(() => act(w, 'owner', { type: 'vehicleTuning', slot, holdCapacity: -1 }));
  assert.throws(() => act(w, 'owner', { type: 'vehicleTuning', slot, cargoKind: 'anything' }));
  assert.deepEqual(w.vehicleTuning, before);
  const html = vehicleEditor(w, slot);
  assert.match(html, /name="holdCapacity"/);
  assert.match(html, /name="cargoKind"/);
  const fresh = createWorld('freight-import', 'Imported', 'new-owner');
  applyDesign(fresh, exportDesign(w));
  assert.deepEqual(fresh.vehicleTuning, w.vehicleTuning);
});
