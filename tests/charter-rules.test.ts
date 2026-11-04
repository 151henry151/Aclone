// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { advanceCharters } from '../src/shared/charter';
import { charterPanel } from '../src/client/charter-panel';
import { Store } from '../src/server/store';
const defaults = {
  charterDefaultFare: 7500,
  charterMaximumFare: 100000,
  charterDefaultMinutes: 60,
  charterMinimumMinutes: 15,
  charterMaximumMinutes: 180,
  charterMaximumOffers: 16,
  charterReturnCooldown: 60,
};
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'owner');
  ensurePuddlewickBoatyard(w);
  w.settings.vehicleLicences = w.settings.requireCaptainSkill = false;
  const d = boatLandings(w).find((d) => d.building)!;
  const shore = (id: string) => {
    const q = addPlayer(w, id, id);
    Object.assign(q, d.land, {
      y: travelHeight(w, d.land.x, d.land.z),
      cash: 3000000,
      online: true,
      inventory: { tackle: 1 },
      fleet: [0, 5],
    });
    return q;
  };
  const c = shore('owner'),
    p = shore('guest');
  act(w, c.id, { type: 'vehicle', slot: 31, building: d.id });
  const edit = (patch: Record<string, unknown>) => act(w, c.id, { type: 'settings', patch });
  const offer = (fare = 7500, minutes = 60, player = p.id) =>
    act(w, c.id, { type: 'charter', operation: 'offer', player, fare, minutes });
  const accept = () => act(w, p.id, { type: 'charter', operation: 'accept', captain: c.id });
  const sea = () => {
    Object.assign(c, { x: 0, z: 1400, speed: 0 });
    Object.assign(p, { x: c.x, z: c.z, y: c.y });
  };
  return { w, c, p, d, shore, edit, offer, accept, sea };
}
test('charter named defaults and absent saved keys preserve quotes and bounds', () => {
  const { w, c, offer } = setup();
  for (const [k, v] of Object.entries(defaults)) assert.equal((w.settings as any)[k], v);
  for (const k of Object.keys(defaults)) delete (w.settings as any)[k];
  assert.match(charterPanel(w, c), /max="1000"[^>]*value="75"/);
  assert.match(charterPanel(w, c), /min="15" max="180" value="60"/);
  offer();
  assert.throws(() => offer(100001), /Fare/);
  assert.throws(() => offer(1, 14), /minutes/);
});
test('local fare duration and outstanding offer limits reject atomically and preserve issued offers', () => {
  const { w, c, p, shore, edit, offer, accept } = setup();
  const q = shore('other');
  edit({
    charterDefaultFare: 1234,
    charterMaximumFare: 2000,
    charterDefaultMinutes: 9,
    charterMinimumMinutes: 3,
    charterMaximumMinutes: 12,
    charterMaximumOffers: 1,
  });
  assert.match(charterPanel(w, c), /max="20"[^>]*value="12.34"/);
  assert.match(charterPanel(w, c), /min="3" max="12" value="9"/);
  for (const [fare, minutes] of [
    [2001, 9],
    [1234, 2],
    [1234, 13],
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => offer(fare, minutes));
    assert.equal(JSON.stringify(w), before);
  }
  offer(1234, 9);
  const before = JSON.stringify(w);
  assert.throws(() => offer(1234, 9, q.id), /Too many/);
  assert.equal(JSON.stringify(w), before);
  offer(1500, 12);
  edit({
    charterMaximumOffers: 0,
    charterMaximumFare: 0,
    charterDefaultFare: 0,
    charterMaximumMinutes: 3,
    charterDefaultMinutes: 3,
  });
  p.cash = 1499;
  const poor = JSON.stringify(w);
  assert.throws(accept, /Not enough cash/);
  assert.equal(JSON.stringify(w), poor);
  p.cash = 1500;
  accept();
  assert.equal(p.cash, 0);
  assert.equal(c.charter!.tickets[p.id].fare, 1500);
  assert.equal(c.charter!.tickets[p.id].minutes, 12);
  assert.throws(() => offer(0, 3, q.id), /Too many/);
});
test('long accepted trips retain duration through lower rules and reload and settle exactly once', () => {
  let { w, c, p, d, edit, offer, accept, sea } = setup();
  edit({ charterMaximumMinutes: 300 });
  offer(1200, 240);
  accept();
  const total = c.cash + p.cash + 1200,
    captainCash = c.cash;
  edit({ charterMaximumMinutes: 30, charterDefaultMinutes: 30 });
  sea();
  advanceCharters(w, 7200);
  assert.equal(c.charter!.elapsed, 7200);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    w = store.loadWorlds()[0].world;
  } finally {
    store.close();
  }
  c = w.players[c.id];
  p = w.players[p.id];
  advanceCharters(w, 7200);
  assert.equal(c.charter!.elapsed, 14400);
  Object.assign(c, d.berth, { speed: 0 });
  advanceCharters(w, 1);
  act(w, c.id, { type: 'charter', operation: 'finish' });
  assert.equal(c.cash, captainCash + 1200);
  assert.equal(c.cash + p.cash, total);
  assert.throws(() => act(w, c.id, { type: 'charter', operation: 'finish' }), /No charter/);
  assert.equal(c.cash, captainCash + 1200);
});
test('lowering new-offer duration never rewinds an already elapsed trip', () => {
  const { w, c, edit, offer, accept, sea } = setup();
  offer(1200, 15);
  accept();
  sea();
  advanceCharters(w, 7200);
  assert.equal(c.charter!.elapsed, 7200);
  edit({ charterMaximumMinutes: 30, charterDefaultMinutes: 30 });
  advanceCharters(w, 1);
  assert.equal(c.charter!.elapsed, 7200);
});
test('return cooldown and free cancellations use local rules without duplicate refunds', () => {
  const { w, c, p, edit, offer, accept } = setup();
  edit({ charterReturnCooldown: 5 });
  offer();
  accept();
  const total = c.cash + p.cash + 7500;
  const request = () => act(w, p.id, { type: 'charter', operation: 'requestReturn' });
  request();
  w.time += 4;
  assert.throws(request, /already been notified/);
  w.time += 1;
  request();
  edit({ charterReturnCooldown: 0 });
  request();
  act(w, c.id, { type: 'charter', operation: 'cancel' });
  assert.equal(c.cash + p.cash, total);
  const cash = p.cash;
  assert.throws(() => act(w, c.id, { type: 'charter', operation: 'cancel' }), /No charter/);
  assert.equal(p.cash, cash);
});
test('charter rules validate jointly and persist through designs and editor summaries', async () => {
  const { w, edit } = setup(),
    { settingsFields } = await import('../src/client/creator-editor'),
    { rulesSummary } = await import('../src/shared/rulesets'),
    { exportDesign, applyDesign } = await import('../src/server/world-design');
  for (const k of Object.keys(defaults)) assert.ok(settingsFields().includes(`name="${k}"`));
  for (const patch of [
    { charterDefaultFare: 100001 },
    { charterMaximumFare: 7499 },
    { charterMinimumMinutes: 61 },
    { charterMaximumMinutes: 59 },
    { charterDefaultMinutes: 181 },
    { charterMaximumOffers: 1.5 },
    { charterMaximumOffers: 101 },
    { charterReturnCooldown: -1 },
    { charterMaximumMinutes: 1441 },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => edit(patch));
    assert.equal(JSON.stringify(w), before);
  }
  edit({
    charterDefaultFare: 1234,
    charterMaximumFare: 5678,
    charterDefaultMinutes: 9,
    charterMinimumMinutes: 3,
    charterMaximumMinutes: 12,
    charterMaximumOffers: 2,
    charterReturnCooldown: 7,
  });
  for (const value of ['1234', '5678', '9', '3', '12', '2', '7'])
    assert.ok(rulesSummary(w).includes(value));
  const dest = createWorld('dest', 'Dest', 'owner');
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
