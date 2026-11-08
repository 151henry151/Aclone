// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';

test('bridge construction and access are live world rules with conservative public defaults', () => {
  const w = createWorld('bridge-rules', 'Bridge workshop', 'owner');
  addPlayer(w, 'owner', 'Builder');
  assert.equal((w.settings as any).bridgeBuilding, true);
  assert.equal((w.settings as any).bridgePublicAccess, true);
  assert.equal((w.settings as any).bridgeToll, 0);
  act(w, 'owner', {
    type: 'settings',
    patch: { bridgeBuilding: false, bridgePublicAccess: false, bridgeToll: 1200 },
  });
  assert.equal((w.settings as any).bridgeBuilding, false);
  assert.equal((w.settings as any).bridgePublicAccess, false);
  assert.equal((w.settings as any).bridgeToll, 1200);
  const saved = structuredClone(w.settings);
  assert.throws(() => act(w, 'owner', { type: 'settings', patch: { bridgeToll: -1 } }));
  assert.deepEqual(w.settings, saved);
});

import { advance } from '../src/shared/simulation';
import { bridgeSite } from './fixtures/bridge-site';
import type { World } from '../src/shared/types';
function quoted() {
  const { w, a, b } = bridgeSite();
  const owner = addPlayer(w, 'owner', 'Founder'),
    donor = addPlayer(w, 'donor', 'Neighbour');
  for (const p of [owner, donor]) {
    Object.assign(p, a);
    p.cash = 20_000_000;
    p.inventory = { steel: 10000, wood: 10000, gravel: 10000, stone: 10000 };
  }
  act(w, owner.id, { type: 'bridge', op: 'survey', a, b, design: 'wide' });
  assert.equal((owner as any).bridgeSurvey.status, 'pending');
  for (let i = 0; i < 2000 && (owner as any).bridgeSurvey.status === 'pending'; i++)
    advance(w, 0.05);
  assert.equal(
    (owner as any).bridgeSurvey.status,
    'ready',
    JSON.stringify((owner as any).bridgeSurvey),
  );
  return { w, a, b, owner, donor, quote: (owner as any).bridgeSurvey };
}
function found(w: World, quote: any) {
  act(w, 'owner', { type: 'bridge', op: 'found', quote: quote.id });
  return (w as any).bridges[0];
}

test('founding reserves a surveyed site and charges only its explicit deposit once', () => {
  const { w, quote, owner } = quoted(),
    before = owner.cash;
  const bridge = found(w, quote);
  assert.equal(bridge.owner, owner.id);
  assert.equal(
    bridge.paid.cash,
    Math.ceil(quote.plan.bill.cash * w.settings.bridgeDepositFraction!),
  );
  assert.equal(owner.cash, before - bridge.paid.cash);
  assert.equal(bridge.completedAt, undefined);
  assert.deepEqual(bridge.paid.materials, { steel: 0, wood: 0, gravel: 0, stone: 0 });
  assert.throws(() => found(w, quote), /quote|survey|used/i);
  assert.equal(owner.cash, before - bridge.paid.cash);
  assert.equal((w as any).bridges.length, 1);
});

test('funding is atomic, explicit, bounded by the bill and protected against stale submissions', () => {
  const { w, quote, owner, donor } = quoted(),
    bridge = found(w, quote);
  const submit = (cash: number, materials: Record<string, number>, revision = bridge.revision) =>
    act(w, donor.id, {
      type: 'bridge',
      op: 'contribute',
      bridge: bridge.id,
      cash,
      materials,
      revision,
    });
  const before = structuredClone({
    cash: donor.cash,
    inventory: donor.inventory,
    paid: bridge.paid,
  });
  assert.throws(() => submit(100, { steel: 10001 }), /material|steel/i);
  assert.deepEqual({ cash: donor.cash, inventory: donor.inventory, paid: bridge.paid }, before);
  assert.throws(() => submit(-1, {}), /amount|cash/i);
  assert.throws(() => submit(0, { fake: 1 }), /material/i);
  assert.throws(() => submit(bridge.bill.cash + 1, {}), /remaining/i);
  const revision = bridge.revision;
  submit(100, { steel: 10 }, revision);
  assert.throws(() => submit(100, { steel: 10 }, revision), /changed|stale/i);
  assert.equal(donor.cash, before.cash - 100);
  assert.equal(donor.inventory.steel, before.inventory.steel - 10);
  const remainingCash = bridge.bill.cash - bridge.paid.cash;
  const remainingMaterials = Object.fromEntries(
    Object.entries(bridge.bill.materials).map(([k, v]) => [
      k,
      (v as number) - bridge.paid.materials[k],
    ]),
  );
  submit(remainingCash, remainingMaterials);
  assert.equal(typeof bridge.completedAt, 'number');
  assert.deepEqual(bridge.paid, bridge.bill);
  assert.equal(
    bridge.contributors[owner.id].cash + bridge.contributors[donor.id].cash,
    bridge.bill.cash,
  );
  assert.throws(() => submit(1, {}), /complete/i);
  const saved = structuredClone(w);
  assert.deepEqual((saved as any).bridges, (w as any).bridges);
});

test('refuse stale terrain/rule quotes, insufficient deposits and remote funding without charging', () => {
  const { w, quote, owner, donor } = quoted(),
    cash = owner.cash;
  owner.cash = 0;
  assert.throws(() => found(w, quote), /cash/i);
  assert.equal((w as any).bridges?.length ?? 0, 0);
  owner.cash = cash;
  w.settings.bridgeCashPerSquareMetre! += 1;
  assert.throws(() => found(w, quote), /changed|survey|quote/i);
  assert.equal(owner.cash, cash);
  w.settings.bridgeCashPerSquareMetre! -= 1;
  const bridge = found(w, quote);
  donor.x += 200;
  assert.throws(
    () =>
      act(w, donor.id, {
        type: 'bridge',
        op: 'contribute',
        bridge: bridge.id,
        cash: 100,
        materials: {},
        revision: bridge.revision,
      }),
    /near|within/i,
  );
  assert.equal(donor.cash, 20_000_000);
});

test('a competing survey cannot reserve the same crossing or spend its deposit', () => {
  const { w, a, b, quote, donor } = quoted();
  act(w, donor.id, { type: 'bridge', op: 'survey', a, b, design: 'wide' });
  for (let i = 0; i < 2000 && (donor as any).bridgeSurvey.status === 'pending'; i++)
    advance(w, 0.05);
  assert.equal((donor as any).bridgeSurvey.status, 'ready');
  const competing = (donor as any).bridgeSurvey.id;
  found(w, quote);
  assert.throws(
    () => act(w, donor.id, { type: 'bridge', op: 'found', quote: competing }),
    /changed|overlap/i,
  );
  assert.equal(donor.cash, 20_000_000);
  assert.equal(w.bridges!.length, 1);
});

test('restart expires unfinished surveys but preserves funded bridges and their contribution accounts', async () => {
  const { Store } = await import('../src/server/store');
  const { w, quote, owner } = quoted();
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const restarted = store.loadWorlds()[0].world;
    assert.throws(() => found(restarted, quote), /expired|survey|quote/i);
    assert.equal(restarted.players.owner.cash, owner.cash);
    const bridge = found(w, quote);
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.bridges, [bridge]);
  } finally {
    store.close();
  }
});

test('maintenance closes worn crossings without deleting their deck, and repair charges the chosen player', () => {
  const { w, quote, owner, donor } = quoted(),
    b = found(w, quote);
  act(w, donor.id, {
    type: 'bridge',
    op: 'contribute',
    bridge: b.id,
    revision: b.revision,
    cash: b.bill.cash - b.paid.cash,
    materials: b.bill.materials,
  });
  w.settings.bridgeWearPerDay = 90;
  advance(w, 600);
  assert.ok(b.condition < w.settings.bridgeMinimumCondition!);
  assert.equal(w.bridges!.length, 1);
  const originalCash = donor.cash,
    originalSteel = donor.inventory.steel;
  const restore = b.condition;
  act(w, donor.id, { type: 'bridge', op: 'repair', bridge: b.id, revision: b.revision });
  assert.equal(b.condition, restore + w.settings.bridgeRepairCondition!);
  assert.equal(donor.cash, originalCash - w.settings.bridgeRepairCash!);
  assert.equal(donor.inventory.steel, originalSteel - w.settings.bridgeRepairSteel!);
  w.settings.bridgePublicAccess = false;
  assert.throws(
    () => act(w, donor.id, { type: 'bridge', op: 'passage', bridge: b.id }),
    /private|owner/i,
  );
  assert.throws(
    () => act(w, donor.id, { type: 'bridge', op: 'remove', bridge: b.id, revision: b.revision }),
    /owner/i,
  );
  owner.x = b.approachA.x;
  owner.z = b.approachA.z;
  donor.x += 500;
  assert.throws(
    () => act(w, owner.id, { type: 'bridge', op: 'remove', bridge: b.id, revision: b.revision }),
    /occupied/i,
  );
});

test('founding rechecks parked vehicles that arrive after a successful survey without taking a deposit', () => {
  const { w, quote, owner } = quoted(),
    cash = owner.cash;
  const q = quote.plan.approachA;
  w.parkedVehicles = {
    'late:0': {
      owner: 'late',
      slot: 0,
      ...q,
      y: 0,
      heading: 0,
      fuel: 10,
      condition: 100,
      parkedAt: w.time,
    } as any,
  };
  assert.throws(() => found(w, quote), /parked|vehicle|footprint/i);
  assert.equal(owner.cash, cash);
  assert.equal(w.bridges?.length ?? 0, 0);
});
