// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { maintainTows, cancelPlayerTows } from '../src/shared/towing';
import { towingPanel } from '../src/client/towing-panel';
import { Store } from '../src/server/store';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
const defaults = { towDefaultFee: 20000, towMaximumFee: 10000000, towOfferSeconds: 600 };
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'tug'),
    c = addPlayer(w, 'captain', 'Captain'),
    t = addPlayer(w, 'tug', 'Tug');
  Object.assign(c, {
    online: true,
    vehicle: 30,
    fleet: [0, 5, 30],
    fuel: 0,
    fuelVehicle: 30,
    inventory: { cod: 10 },
    x: 0,
    z: 1000,
    y: 0,
    speed: 0,
    cash: 100000,
    canBeTowed: true,
  });
  Object.assign(t, {
    online: true,
    vehicle: 32,
    fleet: [0, 5, 32],
    fuel: 512,
    fuelVehicle: 32,
    x: 0,
    z: 1040,
    y: 0,
    speed: 0,
  });
  w.settings.vehicleLicences = w.settings.requireCaptainSkill = false;
  const edit = (patch: Record<string, unknown>) => act(w, t.id, { type: 'settings', patch });
  const offer = (fee = 20000) =>
    act(w, t.id, { type: 'tow', operation: 'offer', owner: c.id, fee });
  const accept = () => act(w, c.id, { type: 'tow', operation: 'accept' });
  return { w, c, t, edit, offer, accept };
}
test('tug fee and offer defaults survive absent saved rules', () => {
  const { w, t, offer } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.match(towingPanel(w, t), /max="100000"[^>]*value="200"/);
  offer();
  w.time += 600;
  maintainTows(w);
  assert.ok(w.towJobs?.captain);
  w.time += 0.01;
  maintainTows(w);
  assert.equal(w.towJobs?.captain, undefined);
});
test('local tow quotes bound new fees and preserve offered fees after limits change', () => {
  const { w, c, t, edit, offer, accept } = setup();
  edit({ towDefaultFee: 1234, towMaximumFee: 2000, towOfferSeconds: 7 });
  assert.match(towingPanel(w, t), /max="20"[^>]*value="12.34"/);
  const before = JSON.stringify(w);
  assert.throws(() => offer(2001), /rescue fee/);
  assert.equal(JSON.stringify(w), before);
  offer(1234);
  edit({ towDefaultFee: 0, towMaximumFee: 0, towOfferSeconds: 1 });
  c.cash = 1233;
  const poor = JSON.stringify(w);
  assert.throws(accept, /Not enough cash/);
  assert.equal(JSON.stringify(w), poor);
  c.cash = 1234;
  w.time += 7;
  accept();
  assert.equal(c.cash, 0);
  assert.equal(w.towJobs!.captain.fee, 1234);
  w.time += 100000;
  maintainTows(w);
  assert.equal(w.towJobs!.captain.state, 'accepted');
  cancelPlayerTows(w, t.id);
  cancelPlayerTows(w, t.id);
  assert.equal(c.cash, 1234);
  offer(0);
  accept();
  cancelPlayerTows(w, c.id);
  assert.equal(c.cash, 1234);
});
test('offer expiry is enforced before maintenance without charging and preserves legacy lifetime', () => {
  const { w, c, edit, offer, accept } = setup();
  edit({ towOfferSeconds: 3 });
  offer();
  const start = w.time;
  w.time = start + 3.01;
  const before = JSON.stringify(w);
  assert.throws(accept, /expired/);
  assert.equal(JSON.stringify(w), before);
  assert.equal(c.cash, 100000);
  maintainTows(w);
  assert.equal(w.towJobs!.captain, undefined);
  offer();
  delete (w.towJobs!.captain as any).expires;
  const legacyStart = w.time;
  edit({ towOfferSeconds: 1 });
  w.time = legacyStart + 600;
  maintainTows(w);
  assert.ok(w.towJobs!.captain);
  w.time += 0.01;
  assert.throws(accept, /expired/);
  maintainTows(w);
  assert.equal(w.towJobs!.captain, undefined);
});
test('stored offered expiry and accepted escrow survive edits reload and delivery exactly once', () => {
  let { w, c, t, edit, offer, accept } = setup();
  edit({ towOfferSeconds: 7 });
  offer(1234);
  const start = w.time;
  edit({ towOfferSeconds: 1, towMaximumFee: 0, towDefaultFee: 0 });
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    w = store.loadWorlds()[0].world;
    c = w.players[c.id];
    t = w.players[t.id];
    w.time = start + 7;
    act(w, c.id, { type: 'tow', operation: 'accept' });
    store.saveWorld(w);
    w = store.loadWorlds()[0].world;
    c = w.players[c.id];
    t = w.players[t.id];
  } finally {
    store.close();
  }
  const tugCash = t.cash;
  assert.equal(c.cash, 100000 - 1234);
  w.time += 100000;
  maintainTows(w);
  assert.equal(w.towJobs!.captain.state, 'accepted');
  act(w, t.id, { type: 'tow', operation: 'hook', owner: c.id });
  ensurePuddlewickBoatyard(w);
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(c, d.berth);
  Object.assign(t, { x: c.x, z: c.z + 40 });
  act(w, t.id, { type: 'tow', operation: 'deliver', owner: c.id });
  assert.equal(t.cash, tugCash + 1234);
  assert.equal(c.cash + t.cash, 100000 + tugCash);
  assert.throws(() => act(w, t.id, { type: 'tow', operation: 'deliver', owner: c.id }));
  assert.equal(t.cash, tugCash + 1234);
});
test('tow rules reject invalid edits atomically and round trip editor summaries designs and saves', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { towDefaultFee: 10000001 },
    { towMaximumFee: 19999 },
    { towDefaultFee: -1 },
    { towMaximumFee: 1e8 + 1 },
    { towOfferSeconds: 0 },
    { towOfferSeconds: 86401 },
    { towOfferSeconds: 2.5 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({ towDefaultFee: 1234, towMaximumFee: 5678, towOfferSeconds: 9 });
  for (const v of ['1234', '5678', '9']) assert.ok(rulesSummary(w).includes(v));
  const dest = createWorld('dest', 'Dest', 'tug');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const k of Object.keys(defaults)) {
      assert.equal((dest.settings as any)[k], (w.settings as any)[k]);
      assert.equal((loaded.settings as any)[k], (w.settings as any)[k]);
    }
  } finally {
    store.close();
  }
});
test('expired default offers cannot be accepted between maintenance ticks', () => {
  const { w, c, offer, accept } = setup();
  offer();
  w.time += 600.01;
  const before = JSON.stringify(w);
  assert.throws(accept, /expired/);
  assert.equal(JSON.stringify(w), before);
  assert.equal(c.cash, 100000);
});
