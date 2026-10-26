// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trawlStatus, TrawlCapacityAlerts } from '../src/client/trawl-status';
import { createWorld, addPlayer } from '../src/shared/simulation';
import { advanceTrawl, trawlAction } from '../src/shared/commercial-fishing';
import { privatePlayer } from '../src/server/snapshots';
import type { Player } from '../src/shared/types';

function setup() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const p = addPlayer(w, 'p', 'Skipper');
  Object.assign(p, { vehicle: 30, x: 0, z: 1400, engine: true, fuel: 10, speed: 2, inventory: {} });
  const status = () => trawlStatus(w, privatePlayer(w, p) as Player);
  return { w, p, status };
}

test('fuel exhaustion preserves the visible net but requires explicit resume after refuelling', () => {
  const { w, p, status } = setup();
  p.trawl = { seconds: 0, fuelUsed: 0, deployed: true, catch: { cod: 2 } };
  p.fuel = 0.001;
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl.deployed, false);
  assert.deepEqual(p.trawl.catch, { cod: 2 });
  assert.equal(status(), 'Towing paused — haul or resume nets');
  p.fuel = 100;
  assert.equal(status(), 'Towing paused — haul or resume nets');
  const before = p.trawl.seconds;
  advanceTrawl(w, p, 60, 120);
  assert.equal(p.trawl.seconds, before);
  trawlAction(w, p, 'deploy');
  assert.equal(status(), 'Towing');
  assert.match(trawlAction(w, p, 'stow'), /Towing stopped/);
  assert.equal(status(), 'Towing paused — haul or resume nets');
  trawlAction(w, p, 'haul');
  assert.equal(status(), 'Nets stowed');
  assert.equal(p.inventory.cod, 2);
});

test('status distinguishes empty stow, capacity stops, engine stop and lack of forward motion', () => {
  const { w, p, status } = setup();
  assert.equal(status(), 'Nets stowed');
  p.trawl = { seconds: 0, fuelUsed: 0, deployed: false, catch: {} };
  assert.equal(status(), 'Nets stowed');
  p.trawl.netFull = true;
  assert.equal(status(), 'Net full — haul it aboard');
  p.trawl.netFull = false;
  p.trawl.holdFull = true;
  assert.equal(status(), 'Hold limit reached — towing stopped');
  p.trawl.holdFull = false;
  p.trawl.deployed = true;
  p.engine = false;
  assert.equal(status(), 'Engine stopped — towing paused');
  p.engine = true;
  p.speed = 0;
  assert.equal(status(), 'Move forward to tow');
  p.speed = 2;
  p.z = 0;
  assert.equal(status(), 'Not enough clear water for the nets');
  assert.equal(Object.hasOwn(privatePlayer(w, p).trawl!, 'catch'), false);
});

test('real full-net stops produce one alert from public snapshots, then rearm after hauling', () => {
  const { w, p, status } = setup();
  const alerts = new TrawlCapacityAlerts();
  const snapshot = () => privatePlayer(w, p) as Player;
  const check = () => alerts.update(w.id, snapshot());
  p.trawl = {
    seconds: 0,
    fuelUsed: 0,
    deployed: true,
    catch: { cod: 159 },
    shoal: { ground: 0, nextChange: 100, nextFish: 0.001, luck: 1, nextLuck: 100 },
  };
  assert.equal(check(), '');
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl.netFull, true);
  assert.equal(p.trawl.deployed, false);
  assert.match(check(), /net is full/);
  assert.equal(status(), 'Net full — haul it aboard');
  for (let i = 0; i < 20; i++) assert.equal(check(), '');
  assert.match(new TrawlCapacityAlerts().update(w.id, snapshot()), /net is full/);
  assert.equal(Object.hasOwn(snapshot().trawl!, 'catch'), false);
  w.time += 1;
  trawlAction(w, p, 'haul');
  assert.equal(check(), '');
  assert.equal(p.inventory.cod, 160);
  p.trawl.netFull = true;
  assert.match(check(), /net is full/);
  assert.equal(check(), '');
  // Even if intervening snapshots were lost, a new haul identifies a new net.
  p.trawl.hauledAt = w.time + 1;
  assert.match(check(), /net is full/);
  assert.match(alerts.update('other-world', snapshot()), /net is full/);
  p.vehicle = 0;
  assert.equal(check(), '');
});

test('hold capacity also alerts once, separately from net capacity', () => {
  const { w, p } = setup();
  const alerts = new TrawlCapacityAlerts();
  p.inventory = { cod: 799 };
  p.trawl = {
    seconds: 0,
    fuelUsed: 0,
    deployed: true,
    catch: {},
    shoal: { ground: 0, nextChange: 100, nextFish: 0.001, luck: 1, nextLuck: 100 },
  };
  advanceTrawl(w, p, 1, 2, false, () => 0.5);
  assert.equal(p.trawl.holdFull, true);
  assert.equal(p.trawl.netFull, false);
  assert.equal(p.trawl.deployed, false);
  assert.match(alerts.update(w.id, privatePlayer(w, p) as Player), /no room/);
  assert.equal(alerts.update(w.id, privatePlayer(w, p) as Player), '');
});
