// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { terrainHeight } from '../src/shared/terrain';
import { workEarthwork } from '../src/shared/earthworks-work';
import { earthworkReserved } from '../src/shared/earthworks-reservations';
import { earthworkContracts } from '../src/shared/earthworks-contracts';

function setup() {
  const w = createWorld('earthwork-contract', 'Earthwork contracts', 'world-owner');
  Object.assign(w, { buildings: [], zones: [], terrain: [], roads: [] });
  Object.assign(w.settings, {
    mapSize: 1000,
    seaLevel: -40,
    spawnClearance: 0,
    townCentreClearance: 0,
    arrivalAnimation: 'off',
    vehicleMaintenance: false,
  });
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    scatter: [],
    barriers: [],
    heightmap: Array(1089).fill(10),
  };
  w.towns[0].tax = 0.2;
  const client = addPlayer(w, 'client', 'Client'),
    a = addPlayer(w, 'a', 'First operator'),
    b = addPlayer(w, 'b', 'Replacement');
  for (const p of [client, a, b])
    Object.assign(p, {
      x: 80,
      z: 80,
      y: 10,
      cash: 1000000,
      vehicle: 38,
      fleet: [0, 5, 38],
      fuel: 100,
      fuelVehicle: 38,
      engine: true,
      speed: 1,
      skills: ['plant operator'],
      earthmovingImplement: true,
    });
  const input = { x: 80, z: 80, width: 8, depth: 8, rotation: 0, target: 9, shoulder: 12 };
  const confirm = () => act(w, client.id, { type: 'earthwork', operation: 'confirm', ...input });
  const action = (id: string, operation: string, extra = {}) =>
    act(w, id, { type: 'earthwork', operation, id: w.earthworks![0].id, ...extra });
  const pass = (p = a, count = 1) => {
    for (let i = 0; i < count; i++) {
      const from = { x: p.x, z: p.z };
      p.z = p.z === 80 ? 81 : 80;
      p.y = terrainHeight(w, p.x, p.z);
      workEarthwork(w, p, from, 1);
      w.time++;
    }
  };
  return { w, client, a, b, input, confirm, action, pass };
}

test('offers hold no cash until a qualified machine owner accepts, and complete exactly once with tax', () => {
  const f = setup();
  f.confirm();
  const before = f.client.cash,
    operatorCash = f.a.cash,
    treasury = f.w.towns[0].treasury;
  f.action(f.client.id, 'offer', { fee: 10000, fillBy: 'client' });
  assert.equal(f.client.cash, before);
  assert.equal(earthworkContracts(f.w).length, 1);
  f.a.skills = [];
  assert.throws(() => f.action(f.a.id, 'accept'), /plant|qualif/i);
  f.a.skills = ['plant operator'];
  f.client.cash = 11999;
  assert.throws(() => f.action(f.a.id, 'accept'), /cash|afford/i);
  assert.equal(f.client.cash, 11999);
  f.client.cash = before;
  f.action(f.a.id, 'accept');
  assert.equal(f.client.cash, before - 12000);
  assert.equal(f.a.cash, operatorCash);
  assert.equal(f.w.earthworks![0].work!.contract!.escrow, 12000);
  assert.throws(() => f.action(f.b.id, 'accept'), /accepted|operator|available/i);
  f.pass(f.a, 5000);
  assert.equal(f.w.earthworks![0].progress, 1);
  assert.equal(f.a.cash, operatorCash + 10000);
  assert.equal(f.w.towns[0].treasury, treasury + 2000);
  assert.equal(f.w.earthworks![0].work!.contract!.state, 'complete');
  assert.equal(f.w.earthworks![0].work!.contract!.escrow, 0);
  f.pass(f.a, 10);
  assert.equal(f.a.cash, operatorCash + 10000);
});

test('abandon refunds escrow once, preserves work and splits a later completion by credited volume', () => {
  const f = setup();
  f.confirm();
  const cash = f.client.cash,
    aCash = f.a.cash,
    bCash = f.b.cash;
  f.action(f.client.id, 'offer', { fee: 10001, fillBy: 'operator' });
  f.action(f.a.id, 'accept');
  f.pass(f.a, 100);
  const credit = f.w.earthworks![0].work!.contract!.contributions.a;
  assert.ok(credit > 0);
  const height = terrainHeight(f.w, 80, 80);
  f.action(f.a.id, 'abandon');
  assert.equal(f.client.cash, cash);
  assert.equal(terrainHeight(f.w, 80, 80), height);
  f.action(f.a.id, 'abandon');
  assert.equal(f.client.cash, cash);
  assert.throws(
    () => f.action(f.client.id, 'offer', { fee: 1, fillBy: 'client' }),
    /terms|work|credited/i,
  );
  f.action(f.b.id, 'accept');
  f.pass(f.b, 5000);
  const contract = f.w.earthworks![0].work!.contract!;
  assert.equal(contract.contributions.a, credit);
  assert.ok(f.a.cash > aCash && f.b.cash > bCash);
  assert.equal(f.a.cash - aCash + f.b.cash - bCash, 10001);
  assert.equal(contract.escrow, 0);
  assert.throws(() => f.action(f.client.id, 'cancelOffer'), /complete|settled/i);
});

test('cancelling an accepted offer refunds once and preserves its scar and recorded terms through save', () => {
  const f = setup();
  f.confirm();
  const cash = f.client.cash;
  f.action(f.client.id, 'offer', { fee: 9000, fillBy: 'client' });
  f.action(f.a.id, 'accept');
  f.pass();
  const restored = JSON.parse(JSON.stringify(f.w));
  assert.equal(restored.earthworks[0].work.contract.escrow, 10800);
  const action = () =>
    act(restored, f.client.id, {
      type: 'earthwork',
      operation: 'cancelOffer',
      id: restored.earthworks[0].id,
    });
  action();
  assert.equal(restored.players.client.cash, cash);
  assert.ok(restored.earthworks[0].work.done > 0);
  action();
  assert.equal(restored.players.client.cash, cash);
});

test('town earthworks and build permissions apply without changing cash or terrain on refusal', () => {
  const f = setup(),
    town = f.w.towns[0];
  town.permissions.guests.earthworks = false;
  const before = structuredClone(f.w);
  assert.throws(f.confirm, /earthwork/i);
  assert.deepEqual(f.w, before);
  town.permissions.residents.earthworks = true;
  town.residents.push(f.client.id);
  f.confirm();
  assert.equal(f.w.earthworks!.length, 1);
  f.action(f.client.id, 'offer', { fee: 10000, fillBy: 'client' });
  assert.throws(
    () => f.action(f.a.id, 'accept'),
    /earthwork/i,
    'a guest operator also needs town permission',
  );
  const g = setup();
  g.w.towns[0].permissions.guests.build = false;
  assert.throws(g.confirm, /build|construction/i);
});

test('foreign property clearance needs owner confirmation before it reserves or alters land', () => {
  const f = setup();
  f.w.settings.constructionMinimumSpacing = 40;
  const house = makeBuilding('neighbour-home', 'home', 120, 80);
  house.owner = f.b.id;
  f.w.buildings.push(house);
  f.confirm();
  const pad = f.w.earthworks![0];
  assert.equal(pad.work!.pendingApproval, true);
  assert.equal(earthworkReserved(f.w, 80, 80), false);
  f.pass(f.client, 100);
  assert.equal(f.w.earthworks![0].progress, 0);
  assert.throws(() => f.action(f.a.id, 'approve'), /owner|permission/i);
  f.action(f.b.id, 'approve');
  assert.equal(f.w.earthworks![0].work!.pendingApproval, false);
  assert.equal(earthworkReserved(f.w, 80, 80), true);
  f.pass(f.client, 100);
  assert.ok(f.w.earthworks![0].progress > 0);
});

test('escrow survives SQLite restart but portable designs retain only terrain, and contract rules round-trip', async () => {
  const { Store } = await import('../src/server/store');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { prepareFrame } = await import('../src/server/snapshots');
  const f = setup();
  f.confirm();
  f.action(f.client.id, 'offer', { fee: 10000, fillBy: 'client' });
  f.action(f.a.id, 'accept');
  f.pass(f.a, 20);
  const store = new Store(':memory:');
  try {
    store.saveWorld(f.w);
    const restored = store.loadWorlds()[0].world;
    assert.deepEqual(restored.earthworks, f.w.earthworks);
    act(restored, f.client.id, {
      type: 'earthwork',
      operation: 'cancelOffer',
      id: restored.earthworks![0].id,
    });
    assert.equal(restored.players.client.cash, 1000000);
  } finally {
    store.close();
  }
  assert.match(prepareFrame(f.w).fields.earthworks, /"escrow":12000/);
  f.w.settings.earthworksNpcFeePerVolume = 250;
  const design = exportDesign(f.w);
  assert.equal((design.earthworks![0] as any).work, undefined);
  const target = createWorld('import', 'Import', 'new-owner');
  applyDesign(target, design);
  assert.equal(target.earthworks![0].work!.contract, undefined);
  assert.equal(target.settings.earthworksNpcFeePerVolume, 250);
  const g = setup();
  g.confirm();
  g.w.settings.earthworksContracts = false;
  assert.throws(() => g.action(g.client.id, 'offer', { fee: 1, fillBy: 'client' }), /disabled/i);
  g.w.settings.earthworksContracts = true;
  g.w.settings.cashTransferLimit = 100;
  assert.throws(() => g.action(g.client.id, 'offer', { fee: 101, fillBy: 'client' }), /limit/i);
  const before = structuredClone(g.w);
  assert.throws(() => g.action(g.client.id, 'offer', { fee: 50, fillBy: 'nobody' }), /supplies/i);
  assert.deepEqual(g.w, before);
});

test('death settles held fees before ordinary cash loss and releases a deceased operator without duplicating payment', async () => {
  const { advance } = await import('../src/shared/simulation');
  for (const who of ['client', 'operator'] as const) {
    const f = setup();
    f.confirm();
    f.action(f.client.id, 'offer', { fee: 10000, fillBy: 'client' });
    f.action(f.a.id, 'accept');
    f.pass(f.a, 5);
    const p = who === 'client' ? f.client : f.a;
    Object.assign(f.w.settings, {
      deathCashRetention: 0.5,
      losePropertyOnDeath: false,
      loseInventoryOnDeath: true,
    });
    Object.assign(p, {
      health: 1,
      hunger: 50000,
      thirst: 50000,
      needsGraceUntil: 0,
      inventory: {},
      earthmovingCargo: { 39: { dirt: 2 } },
    });
    advance(f.w, 1);
    assert.equal(p.deaths, 1);
    assert.equal(f.client.cash, who === 'client' ? 500000 : 1000000);
    assert.equal(f.w.earthworks![0].work!.contract!.escrow, 0);
    assert.equal(
      f.w.earthworks![0].work!.contract!.state,
      who === 'client' ? 'cancelled' : 'offered',
    );
    assert.equal(p.earthmovingCargo, undefined);
    assert.equal(p.earthmovingImplement, undefined);
  }
});

test('pending property surveys can be withdrawn or declined without touching the ground', () => {
  const f = setup();
  f.w.settings.constructionMinimumSpacing = 40;
  const b = makeBuilding('neighbour', 'home', 120, 80);
  b.owner = f.b.id;
  f.w.buildings.push(b);
  f.confirm();
  const height = terrainHeight(f.w, 80, 80);
  assert.throws(() => f.action(f.a.id, 'withdrawSurvey'), /owner|permission/i);
  f.action(f.b.id, 'withdrawSurvey');
  assert.equal(f.w.earthworks!.length, 0);
  assert.equal(terrainHeight(f.w, 80, 80), height);
  f.confirm();
  f.action(f.client.id, 'withdrawSurvey');
  assert.equal(f.w.earthworks!.length, 0);
});
