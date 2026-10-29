import { refuelRecipientReady } from '../src/shared/player-aid';
import { repairRecipientReady } from '../src/shared/vehicle-services';
// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, canCarry } from '../src/shared/simulation';
import { vehicleDef, isTrawler, hasProvisions, crewBerths } from '../src/shared/vehicle-config';
import { boatSlot, poweredBoat, throttleBoat } from '../src/shared/boats';
import { fuelCapacity, switchVehicle } from '../src/shared/tractors';
import { trawlAction, advanceTrawl } from '../src/shared/commercial-fishing';
import { abandonBoatOnDeath } from '../src/shared/boat-rescue';
import { applyDesign, exportDesign } from '../src/server/world-design';
import { creatorSchema } from '../src/shared/creator';
import { Store } from '../src/server/store';
const fixture = () => {
  const w = createWorld('config', 'Config', 'owner'),
    p = addPlayer(w, 'owner', 'Builder');
  w.settings.vehicleLicences = false;
  w.settings.mapSize = 20000;
  return { w, p };
};
const tune = (w: ReturnType<typeof fixture>['w'], patch: Record<string, unknown>, slot = 8) =>
  act(w, 'owner', { type: 'vehicleTuning', slot, ...patch });
test('custom slots resolve independent names, prices, cargo and fuel in each world and survive design/save round trips', () => {
  const { w, p } = fixture();
  tune(w, {
    name: 'Harbour tender',
    mode: 3,
    tank: 500,
    capacity: 700,
    price: 55000,
    hitch: 4,
    persistentThrottle: true,
    trawling: true,
    provisions: true,
    crew: 1,
  });
  assert.equal(vehicleDef(w, 8).name, 'Harbour tender');
  assert.ok(boatSlot(8, w) && poweredBoat(8, w) && throttleBoat(8, w) && isTrawler(8, w));
  assert.ok(hasProvisions(8, w));
  assert.equal(crewBerths(8, w), 1);
  switchVehicle(p, 8, true, w);
  assert.equal(fuelCapacity(p, w), 500);
  p.inventory = { water: 699 };
  assert.ok(canCarry(p, 'water', 1, w));
  assert.ok(!canCarry(p, 'water', 2, w));
  const other = createWorld('other', 'Other', 'owner');
  assert.equal(poweredBoat(8, other), false);
  applyDesign(other, exportDesign(w));
  assert.deepEqual(other.vehicleTuning, w.vehicleTuning);
  const store = new Store(':memory:');
  store.saveWorld(w);
  assert.deepEqual(store.loadWorlds()[0].world.vehicleTuning, w.vehicleTuning);
  store.close();
});
test('custom trawlers enforce their own hold and net capacities and use configured throttle and burn', () => {
  const { w, p } = fixture();
  tune(w, {
    mode: 3,
    trawling: true,
    persistentThrottle: true,
    capacity: 200,
    netCapacity: 20,
    trawlFuel: 0.02,
    trawlSpeed: 1.5,
  });
  Object.assign(p, {
    vehicle: 8,
    fuelVehicle: 8,
    heading: 0,
    x: 0,
    z: 1400,
    y: w.settings.seaLevel,
    engine: true,
    fuel: 100,
    speed: 2,
    inventory: { stone: 201 },
    boatStores: {},
  });
  assert.throws(() => trawlAction(w, p, 'deploy'), /room/);
  p.inventory = {};
  trawlAction(w, p, 'deploy');
  const before = p.fuel;
  advanceTrawl(w, p, 1, 2, true);
  assert.ok(before - p.fuel < 0.03);
  p.trawl!.deployed = false;
  move(w, p, { throttle: 1, steer: 0, boost: false }, 1);
  const throttle = p.boatThrottle!;
  move(w, p, { throttle: 0, steer: 0, boost: false }, 1);
  assert.equal(p.boatThrottle, throttle);
  assert.ok(p.z > 1400);
});
test('mixed vessel death rules preserve a recoverable custom boat while removing loss-policy boats', () => {
  const { w, p } = fixture();
  w.settings.loseBoatsOnDeath = true;
  tune(w, { mode: 3, deathPolicy: 'recover', spoilageDays: 2, retainFuel: false });
  Object.assign(p, {
    vehicle: 8,
    fuelVehicle: 8,
    fuel: 100,
    fleet: [0, 5, 8, 30],
    x: 0,
    z: 1400,
    y: w.settings.seaLevel,
    inventory: { fish: 20 },
    boatStores: { bread: 5 },
  });
  abandonBoatOnDeath(w, p, 10);
  assert.ok(p.fleet!.includes(8));
  assert.ok(!p.fleet!.includes(30));
  assert.equal(w.boatRescues![p.id].boat.slot, 8);
  assert.equal(w.boatRescues![p.id].spoilage!.daysLeft, 2);
  assert.equal(p.fuel, 0);
  assert.deepEqual(w.boatRescues![p.id].cargo, { fish: 20 });
});
test('configuration is owner-only, bounded, rejects incompatible capabilities and cannot strand an occupied vehicle', () => {
  const { w, p } = fixture(),
    guest = addPlayer(w, 'guest', 'Guest');
  assert.throws(() => act(w, guest.id, { type: 'vehicleTuning', slot: 8, speed: 30 }), /owner/i);
  for (const patch of [
    { tank: -1 },
    { capacity: Infinity },
    { crew: 3 },
    { mode: 0, trawling: true },
    { components: [{ model: 'missing', role: 'body', x: 0, y: 0, z: 0, scale: 1, yaw: 0 }] },
  ])
    assert.throws(() => tune(w, patch));
  assert.equal(w.vehicleTuning?.[8], undefined);
  p.vehicle = 8;
  assert.throws(() => tune(w, { mode: 3 }), /Disembark/);
  p.vehicle = 0;
  tune(w, { speed: 22 });
  act(w, p.id, { type: 'vehicleReset', slot: 8 });
  assert.equal(w.vehicleTuning?.[8], undefined);
});
test('component assets, cockpit, lights and instruments round-trip and media-free export removes image references', () => {
  const { w } = fixture();
  w.creator = creatorSchema.parse({
    models: [{ id: 'wheel', name: 'Wheel', parts: [{ shape: 'cylinder' }] }],
  });
  w.assets = [{ id: 'art', name: 'Artwork', type: 'image/png', url: '/world-assets/art.png' }];
  tune(
    w,
    {
      dashboard: 'art',
      trackTexture: 'art',
      cockpit: { x: 0, y: 2, z: 0.3 },
      instruments: ['heading', 'fuel'],
      lights: [{ x: 0, y: 3, z: 0, color: '#ff0000', intensity: 3, blink: 1, switch: 'always' }],
      components: [{ model: 'wheel', role: 'wheel', x: 1, y: 0.5, z: 1, scale: 1, yaw: 90 }],
    },
    31,
  );
  const withMedia = exportDesign(w, true),
    copy = createWorld('copy', 'Copy', 'owner');
  copy.assets = w.assets;
  applyDesign(copy, withMedia);
  assert.deepEqual(copy.vehicleTuning, w.vehicleTuning);
  const plain = exportDesign(w);
  assert.equal(plain.vehicleTuning[31].dashboard, undefined);
  assert.equal(plain.vehicleTuning[31].trackTexture, undefined);
  assert.throws(
    () => act(w, 'owner', { type: 'creator', creator: { ...w.creator, models: [] } }),
    /missing model/,
  );
});
test('restoring defaults cannot discard loaded fuel or cargo, including parked tanks', () => {
  const { w, p } = fixture();
  tune(w, { tank: 500, capacity: 1000 });
  p.vehicle = 8;
  p.fuelVehicle = 8;
  p.fuel = 400;
  assert.throws(() => act(w, p.id, { type: 'vehicleReset', slot: 8 }), /fuel/);
  p.fuel = 0;
  p.inventory = { water: 900 };
  assert.throws(() => act(w, p.id, { type: 'vehicleReset', slot: 8 }), /cargo/);
  p.vehicle = 0;
  p.inventory = {};
  p.parkedFuel = { 8: 400 };
  assert.throws(() => act(w, p.id, { type: 'vehicleReset', slot: 8 }), /parked/);
});
test('capability edits preserve stored provisions and outstanding expeditions', () => {
  const { w, p } = fixture();
  tune(w, { mode: 3, provisions: true, trawling: true, crew: 2 });
  p.vehicle = 8;
  p.boatStores = { bread: 3 };
  assert.throws(() => tune(w, { provisions: false, crew: 0 }), /provisions/);
  p.boatStores = {};
  p.trawl = { deployed: false, seconds: 0, catch: { fish: 1 } } as any;
  assert.throws(() => tune(w, { trawling: false }), /Haul/);
});

test('custom tanks and lighting are respected by assistance and service controls', () => {
  const { w, p } = fixture();
  tune(w, {
    mode: 0,
    fuel: 0.1,
    tank: 200,
    lights: [{ x: 0, y: 2, z: 0, color: '#ffffff', intensity: 2, blink: 0, switch: 'deck' }],
  });
  p.vehicle = 8;
  p.online = true;
  p.fuel = 150;
  p.speed = 0;
  assert.equal(refuelRecipientReady(p, w), true);
  p.fleetState = { 8: { condition: 75, metres: 10, acquiredAt: 0 } };
  assert.equal(repairRecipientReady(p, w), true);
  act(w, p.id, { type: 'boatLights', circuit: 'deck' });
  assert.equal(p.boatLighting?.deck, true);
});
