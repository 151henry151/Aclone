// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedBridgeSite } from './fixtures/bridge-site';
import { createWorld } from '../src/shared/simulation';
import { exportDesign, applyDesign } from '../src/server/world-design';

test('portable designs retain funded geometry and partial bills while remapping ownership and economic ages', () => {
  for (const complete of [false, true]) {
    const { w, bridge } = completedBridgeSite();
    w.time = 2000;
    bridge.foundedAt = 100;
    bridge.wearAt = 1900;
    bridge.completedAt = 500;
    if (!complete) {
      delete bridge.completedAt;
      bridge.paid.cash = 1200;
      bridge.paid.materials.steel = 100;
    }
    bridge.contributors = { donor: structuredClone(bridge.paid) };
    w.settings.bridgeToll = 50;
    w.settings.bridgePublicAccess = false;
    w.settings.bridgeWearPerDay = 0;
    const design = exportDesign(w);
    const target = createWorld('new', 'Imported', 'new-owner');
    target.time = 10000;
    applyDesign(target, design);
    assert.equal(target.bridges?.length, 1);
    const b = target.bridges![0];
    assert.equal(b.owner, 'new-owner');
    assert.deepEqual(b.contributors, { 'new-owner': bridge.paid });
    assert.deepEqual(b.paid, bridge.paid);
    assert.deepEqual(b.bill, bridge.bill);
    assert.deepEqual(b.foundations, bridge.foundations);
    assert.deepEqual(b.ramps, bridge.ramps);
    assert.equal(b.deckY, bridge.deckY);
    assert.equal(b.foundedAt, target.time - 1900);
    assert.equal(b.wearAt, target.time - 100);
    assert.equal(b.completedAt, complete ? target.time - 1500 : undefined);
    assert.equal(target.settings.bridgeToll, 50);
    assert.equal(target.settings.bridgeWearPerDay, 0);
    assert.deepEqual(target.players, {});
    assert.equal(target.bridgeSequence, 1);
  }
});

test('bridge imports reject malformed geometry, funding and duplicate sites atomically', () => {
  const { w } = completedBridgeSite();
  for (const corrupt of [
    (b: any) => b.paid.cash++,
    (b: any) => b.contributors.owner.cash--,
    (b: any) => b.ramps[0].rows[1].heights.pop(),
    (b: any) => (b.foundations[0] = b.deckY + 5),
    (b: any) => (b.approachA.x += 5),
    (b: any) => (b.deckY += 100),
  ]) {
    const d: any = exportDesign(w);
    assert.ok(d.bridges?.length, 'bridge geometry must be exported');
    corrupt(d.bridges[0]);
    const target = createWorld('new', 'Imported', 'new-owner'),
      saved = structuredClone(target);
    assert.throws(() => applyDesign(target, d), /bridge|ramp|fund|contribut|ground|approach/i);
    assert.deepEqual(target, saved);
  }
  const d: any = exportDesign(w);
  d.bridges.push({ ...structuredClone(d.bridges[0]), id: 'bridge:2' });
  const target = createWorld('new', 'Imported', 'new-owner');
  assert.throws(() => applyDesign(target, d), /bridge|overlap/i);
});
