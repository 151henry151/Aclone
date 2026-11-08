// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { constructionSiteReason } from '../src/shared/construction-site';
import { farmExpansionBlocker, farmPlotPosition } from '../src/shared/farm-land';
import { pastureBlocker } from '../src/shared/pastures';
import { parkingBlocker } from '../src/shared/ground-parking';
import { act, addPlayer, makeBuilding } from '../src/shared/simulation';
import { roadGeometryKey } from '../src/shared/road-work';

test('unfinished and completed bridge sites reserve buildings, fields, pastures and parking', () => {
  for (const complete of [false, true]) {
    const { w, bridge, point } = completedBridgeSite();
    if (!complete) delete bridge.completedAt;
    const q = point(-60);
    const house = makeBuilding('house', 'home', q.x, q.z);
    assert.match(constructionSiteReason(w, house) ?? '', /bridge/i);
    const farm = makeBuilding('farm', 'farm', 0, 0);
    const offset = farmPlotPosition(farm, 4);
    farm.x = q.x - offset.x;
    farm.z = q.z - offset.z;
    assert.match(farmExpansionBlocker(w, farm) ?? '', /bridge/i);
    const barn = makeBuilding('barn', 'dairy', q.x, q.z);
    assert.match(
      pastureBlocker(w, barn, { x: 0, z: 0, parcels: 1, parcelSize: 16 }) ?? '',
      /bridge/i,
    );
    const p = addPlayer(w, 'owner', 'Builder');
    Object.assign(p, q, { vehicle: 1 });
    assert.match(parkingBlocker(w, p) ?? '', /bridge/i);
    w.settings.clearRouteParking = false;
    assert.equal(parkingBlocker(w, p), undefined, 'honour the existing world parking switch');
  }
});

test('bridge rules validate related dimensions atomically', () => {
  const { w } = completedBridgeSite();
  addPlayer(w, 'owner', 'Builder');
  for (const patch of [
    { bridgeNarrowWidth: 12, bridgeWidth: 8 },
    { bridgeMaximumSpan: 5, bridgeFoundationLength: 4 },
  ]) {
    const saved = structuredClone(w.settings);
    assert.throws(
      () => act(w, 'owner', { type: 'settings', patch }),
      /bridge|lane|span|foundation/i,
    );
    assert.deepEqual(w.settings, saved);
  }
});

test('road surveys invalidate on bridge completion, closure and removal, not donations or small wear', () => {
  const { w, bridge } = completedBridgeSite();
  const key = roadGeometryKey(w);
  bridge.paid.cash--;
  bridge.revision++;
  bridge.condition -= 0.01;
  assert.equal(roadGeometryKey(w), key);
  bridge.condition = 0;
  assert.notEqual(roadGeometryKey(w), key);
  bridge.condition = 100;
  delete bridge.completedAt;
  assert.notEqual(roadGeometryKey(w), key);
  bridge.completedAt = w.time;
  w.bridges = [];
  assert.notEqual(roadGeometryKey(w), key);
});

test('unhitching cannot leave a loaded trailer across a protected bridge passage', () => {
  const { w, point } = completedBridgeSite(),
    p = addPlayer(w, 'owner', 'Driver');
  Object.assign(p, point(-60), { vehicle: 0 });
  const t = {
    id: 'rig',
    owner: p.id,
    attached: p.id,
    kind: 'dump' as const,
    ...point(-60),
    heading: p.heading,
    cargo: { stone: 10 },
  };
  w.trailers = { rig: t };
  assert.throws(() => act(w, p.id, { type: 'trailer', operation: 'unhitch', id: t.id }), /bridge/i);
  assert.equal(t.attached, p.id);
  assert.deepEqual(t.cargo, { stone: 10 });
  w.settings.clearRouteParking = false;
  act(w, p.id, { type: 'trailer', operation: 'unhitch', id: t.id });
  assert.equal(t.attached, undefined);
});
