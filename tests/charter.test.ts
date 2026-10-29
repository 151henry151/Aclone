// SPDX-License-Identifier: GPL-3.0-or-later
import { Store } from '../src/server/store';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, move, advance } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
import { fishingDock, travelHeight } from '../src/shared/dock';
import { CHARTER_BOAT } from '../src/shared/boats';
import { advanceCharters, cancelChartersOnDeath } from '../src/shared/charter';
import { deepBoatFishing } from '../src/shared/boat-fishing';
import { privatePlayer, prepareFrame } from '../src/server/snapshots';
import { vehicles } from '../src/shared/catalog';
function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  ensurePuddlewickBoatyard(w);
  w.settings.vehicleLicences = false;
  const d = boatLandings(w).find((d) => d.building)!;
  const c = addPlayer(w, 'c', 'Captain'),
    p = addPlayer(w, 'p', 'Passenger');
  for (const q of [c, p])
    Object.assign(q, d.land, {
      y: travelHeight(w, d.land.x, d.land.z),
      cash: 3000000,
      online: true,
      inventory: { tackle: 1 },
      fleet: [0, 5],
    });
  act(w, c.id, { type: 'vehicle', slot: CHARTER_BOAT, building: d.id });
  const action = (operation: string, opts: Record<string, unknown> = {}) =>
    act(w, c.id, { type: 'charter', operation, ...opts });
  const invite = (fare = 7500, minutes = 60) => {
    action('offer', { player: p.id, fare, minutes });
    act(w, p.id, { type: 'charter', operation: 'accept', captain: c.id });
  };
  const sea = () => {
    Object.assign(c, { x: 0, z: 1400, speed: 0 });
    Object.assign(p, { x: c.x, z: c.z, y: c.y });
  };
  const port = () => Object.assign(c, d.berth, { speed: 0 });
  return { w, c, p, d, action, invite, sea, port };
}
test('charter purchase, consent, escrow and cancellation conserve money without duplicating refunds', () => {
  const { w, c, p, action, invite } = setup();
  assert.equal(c.cash, 3000000 - vehicles[CHARTER_BOAT].price);
  const before = c.cash + p.cash;
  invite();
  assert.equal(p.cash, 2992500);
  assert.equal(c.charter!.tickets.p.fare, 7500);
  assert.equal(c.cash + p.cash + 7500, before);
  assert.throws(
    () => act(w, p.id, { type: 'charter', operation: 'accept', captain: c.id }),
    /no longer/,
  );
  action('cancel');
  assert.equal(c.cash + p.cash, before);
  assert.equal(p.cash, 3000000);
  assert.equal(p.hitch, undefined);
  assert.throws(() => action('cancel'), /No charter/);
  assert.equal(p.cash, 3000000);
});
test('early return pays only time away; restart preserves escrow and private projections hide others fares', () => {
  let { w, c, p, invite, sea, port } = setup();
  const cash = c.cash;
  invite();
  advanceCharters(w, 600);
  assert.equal(c.charter!.elapsed, 0);
  sea();
  advanceCharters(w, 1800);
  const snap = privatePlayer(w, p);
  assert.equal(snap.charterElapsed, 1800);
  assert.equal(snap.charterPassage!.fare, 7500);
  const publicCaptain = JSON.parse(prepareFrame(w).players.c);
  assert.equal(publicCaptain.charter, undefined);
  const store = new Store(':memory:');
  store.saveWorld(w);
  w = store.loadWorlds()[0].world;
  store.db.close();
  c = w.players.c;
  p = w.players.p;
  const d = boatLandings(w).find((d) => d.id === c.charter!.dock)!;
  Object.assign(c, d.berth, { speed: 0 });
  advanceCharters(w, 1);
  act(w, c.id, { type: 'charter', operation: 'finish' });
  assert.equal(c.cash, cash + 3750);
  assert.equal(p.cash, 3000000 - 3750);
  assert.equal(p.charterPassage, undefined);
  assert.equal(p.hitch, undefined);
});
test('full trips cap fare at agreement, notify once, and do not keep charging after returning', () => {
  const { w, c, p, invite, sea, port, action } = setup();
  invite(6000, 15);
  sea();
  advanceCharters(w, 900);
  const notices = w.messages.filter((m) => m.text.includes('agreed trip time')).length;
  assert.equal(notices, 2);
  advanceCharters(w, 600);
  assert.equal(w.messages.filter((m) => m.text.includes('agreed trip time')).length, 2);
  port();
  advanceCharters(w, 100);
  const elapsed = c.charter!.elapsed;
  advanceCharters(w, 600);
  assert.equal(c.charter!.elapsed, elapsed);
  action('finish');
  assert.equal(p.cash, 2994000);
});
test('passengers rod-fish in place, keep their catch and cannot teleport or fish from a moving charter', () => {
  const { w, c, p, invite, sea } = setup();
  invite();
  sea();
  advanceCharters(w, 1);
  assert.equal(deepBoatFishing(w, p), true);
  act(w, p.id, { type: 'joinGame', game: 'fishing' });
  assert.equal(p.z, 1400);
  assert.ok(p.fishAt! >= w.time + 150);
  p.fishAt = w.time;
  p.fishUntil = w.time + 8;
  p.fishCatch = 'cod';
  act(w, p.id, { type: 'reel' });
  assert.equal(p.inventory.cod, 1);
  assert.equal(c.inventory.cod, undefined);
  for (const a of [
    { type: 'vehicle', slot: 5 },
    { type: 'home' },
    { type: 'joinGame', game: 'race' },
    { type: 'detach' },
  ])
    assert.throws(() => act(w, p.id, a));
  c.speed = 2;
  p.fishAt = w.time;
  p.fishUntil = w.time + 8;
  assert.throws(() => act(w, p.id, { type: 'reel' }), /stop/);
  advanceCharters(w, 1);
  assert.equal(p.game, undefined);
  assert.equal(p.fishAt, undefined);
  assert.throws(() => act(w, p.id, { type: 'joinGame', game: 'fishing' }), /Stop/);
});
test('six seats, dock-only offers and accepting, finite prices, no free hitch to bypass fare', () => {
  const { w, c, p, d, action } = setup();
  for (const fare of [-1, NaN, Infinity, 1.5, 100001])
    assert.throws(() => action('offer', { player: p.id, fare, minutes: 60 }));
  for (const minutes of [0, 181, Infinity, 15.5])
    assert.throws(() => action('offer', { player: p.id, fare: 0, minutes }));
  assert.throws(() => act(w, p.id, { type: 'hitch', player: c.id }));
  action('offer', { player: p.id, fare: 0, minutes: 15 });
  p.z += 200;
  assert.throws(
    () => act(w, p.id, { type: 'charter', operation: 'accept', captain: c.id }),
    /dock/,
  );
  for (let i = 0; i < 7; i++) {
    const q = addPlayer(w, 'g' + i, 'Guest ' + i);
    Object.assign(q, d.land, { y: travelHeight(w, d.land.x, d.land.z), online: true });
    action('offer', { player: q.id, fare: 0, minutes: 15 });
    const join = () => act(w, q.id, { type: 'charter', operation: 'accept', captain: c.id });
    if (i < 6) join();
    else assert.throws(join, /six/);
  }
  assert.equal(Object.keys(c.charter!.tickets).length, 6);
});
test('death cancellation refunds fares; voluntary return detaches and settles just once', () => {
  const { w, c, p, invite, sea, port } = setup();
  invite();
  sea();
  advanceCharters(w, 100);
  cancelChartersOnDeath(w, c);
  cancelChartersOnDeath(w, c);
  assert.equal(p.cash, 3000000);
  assert.equal(p.charterPassage, undefined);
  delete p.hitch;
  Object.assign(p, boatLandings(w).find((d) => d.building)!.land);
  p.y = travelHeight(w, p.x, p.z);
  port();
  invite();
  sea();
  advanceCharters(w, 1800);
  port();
  act(w, p.id, { type: 'detach' });
  assert.equal(p.cash, 2996250);
  assert.equal(p.hitch, undefined);
  assert.equal(Object.keys(c.charter!.tickets).length, 0);
  act(w, c.id, { type: 'charter', operation: 'finish' });
  assert.equal(p.cash, 2996250);
});
test('charter persistent throttle, reverse, braking and no boosted speed; canal remains held throttle', () => {
  const { w, c } = setup();
  Object.assign(c, { x: 0, z: 2000, fuel: 192, engine: true });
  for (let i = 0; i < 30; i++) move(w, c, { throttle: 1, steer: 0, boost: false }, 0.1);
  const set = c.boatThrottle!;
  assert.ok(set > 0.6);
  move(w, c, { throttle: 0, steer: 0, boost: false }, 0.1);
  assert.equal(c.boatThrottle, set);
  for (let i = 0; i < 500; i++) move(w, c, { throttle: 0, steer: 0, boost: true }, 0.1);
  assert.ok(c.speed <= vehicles[CHARTER_BOAT].speed + 0.01);
  act(w, c.id, { type: 'boatIdle' });
  assert.equal(c.boatThrottle, 0);
  for (let i = 0; i < 200; i++) move(w, c, { throttle: -1, steer: 0, boost: false }, 0.1);
  assert.ok(c.boatThrottle! < 0);
  assert.ok(c.speed < 0);
});

test('moving charter cancels auto-fishing before catch processing; real captain death refunds and puts survivors in a lifeboat', () => {
  const { w, c, p, invite, sea } = setup();
  invite();
  sea();
  w.settings.fishingMode = 2;
  act(w, p.id, { type: 'joinGame', game: 'fishing' });
  p.fishAt = w.time - 2;
  p.fishUntil = w.time - 1;
  p.fishCatch = 'tuna';
  c.speed = 2;
  advance(w, 1);
  assert.equal(p.inventory.tuna, undefined);
  assert.equal(p.game, undefined);
  c.speed = 0;
  c.health = 1;
  c.hunger = 50000;
  c.thirst = 50000;
  c.needsGraceUntil = 0;
  c.inventory = {};
  advance(w, 1);
  assert.equal(c.deaths, 1);
  assert.equal(p.cash, 3000000);
  assert.equal(p.hitch, undefined);
  assert.equal(p.vehicle, 29);
  assert.equal(p.charterPassage, undefined);
});
test('maximum duration notice cannot repeat at the elapsed-time cap or after return', () => {
  const { w, c, invite, sea, port } = setup();
  invite(7500, 180);
  sea();
  advanceCharters(w, 10800);
  port();
  for (let i = 0; i < 10; i++) advanceCharters(w, 1);
  assert.equal(w.messages.filter((m) => m.text.includes('agreed trip time')).length, 2);
});

test('returning to the other side of the same public pier still pays the agreed fare', () => {
  const { w, c, p, invite, sea } = setup();
  const cash = c.cash;
  invite(6000, 15);
  c.charter!.dock = `${fishingDock.id}:-1:169`;
  sea();
  advanceCharters(w, 900);
  const otherSide = boatLandings(w).find((d) => d.id === `${fishingDock.id}:1:169`)!;
  assert.ok(otherSide);
  Object.assign(c, otherSide.berth, { speed: 0 });
  advanceCharters(w, 1);
  act(w, c.id, { type: 'charter', operation: 'finish' });
  assert.equal(c.cash, cash + 6000);
  assert.equal(p.cash, 3000000 - 6000);
  assert.equal(p.hitch, undefined);
});
