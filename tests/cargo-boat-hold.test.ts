// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { act, addPlayer, createWorld, advance } from '../src/shared/simulation';
import { ensurePuddlewickBoatyard } from '../src/server/puddlewick-boatyard';
import { boatLandings } from '../src/shared/boathouse';
import { travelHeight } from '../src/shared/dock';
import { abandonBoatOnDeath, rescueAction } from '../src/shared/boat-rescue';
export function freightSetup() {
  const w = createWorld('puddlewick', 'Freight', 'owner');
  ensurePuddlewickBoatyard(w);
  const p = addPlayer(w, 'owner', 'Captain');
  w.settings.requireCaptainSkill = false;
  w.settings.vehicleLicences = false;
  const d = boatLandings(w).find((d) => d.building)!;
  Object.assign(p, d.land, {
    y: travelHeight(w, d.land.x, d.land.z),
    cash: 10000000,
    inventory: {},
    vehicle: 5,
    online: true,
  });
  act(w, p.id, { type: 'vehicle', slot: 35, building: d.id });
  return { w, p, d };
}
test('freight stays with its moored boat at a boatyard through reload and reboarding', () => {
  const { w, p, d } = freightSetup();
  (p as any).boatHold = { stone: 100 };
  p.inventory = { bread: 2 };
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  assert.deepEqual((w.mooredBoats?.[p.id + ':35'] as any)?.cargo, { stone: 100 });
  assert.equal((p as any).boatHold, undefined);
  assert.deepEqual(p.inventory, { bread: 2 });
  const loaded = JSON.parse(JSON.stringify(w));
  act(loaded, p.id, { type: 'vehicle', slot: 35, building: d.id });
  assert.deepEqual(loaded.players[p.id].boatHold, { stone: 100 });
  assert.equal(loaded.mooredBoats?.[p.id + ':35'], undefined);
  assert.deepEqual(loaded.players[p.id].inventory, { bread: 2 });
});
test('young livestock retain cohort progress when their freight vessel moors or is rescued', () => {
  for (const operation of ['moor', 'rescue'] as const) {
    const { w, p, d } = freightSetup();
    act(w, p.id, { type: 'vehicleTuning', slot: 35, cargoKind: 'livestock' });
    p.boatHold = { calves: 1 };
    p.boatHoldLife = { young: [{ item: 'calves', count: 1, born: 0, grownDays: 12 }] };
    if (operation === 'moor') {
      act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
      assert.equal(w.mooredBoats![p.id + ':35'].cargoLife?.young?.[0].grownDays, 12);
      assert.equal(p.boatHoldLife, undefined);
      act(w, p.id, { type: 'vehicle', slot: 35, building: d.id });
    } else {
      Object.assign(p, { x: 0, z: 1000, fuel: 0 });
      rescueAction(w, p, 'launch');
      assert.equal(p.boatHoldLife, undefined);
      const r = w.boatRescues![p.id];
      Object.assign(p, {
        vehicle: 29,
        x: r.boat.x + 5,
        z: r.boat.z,
        y: 0,
        speed: 0,
        inventory: {},
        health: 100,
      });
      rescueAction(w, p, 'reboard');
    }
    assert.equal(w.players[p.id].boatHoldLife?.young?.[0].grownDays, 12);
    assert.equal(p.boatHold?.calves, 1);
  }
});
test('lifeboat rescue and recoverable death keep freight separate from personal cargo', () => {
  for (const death of [false, true]) {
    const { w, p } = freightSetup();
    Object.assign(p, { x: 0, z: 1000, fuel: 0, boatHold: { stone: 100 }, inventory: { bread: 2 } });
    w.settings.loseBoatsOnDeath = false;
    if (death) abandonBoatOnDeath(w, p, w.time);
    else rescueAction(w, p, 'launch');
    const r = w.boatRescues![p.id];
    assert.deepEqual((r as any).hold, { stone: 100 });
    assert.equal((p as any).boatHold, undefined);
    Object.assign(p, {
      vehicle: 29,
      x: r.boat.x + 5,
      z: r.boat.z,
      y: 0,
      speed: 0,
      inventory: {},
      health: 100,
    });
    rescueAction(w, p, 'reboard');
    assert.deepEqual((p as any).boatHold, { stone: 100 });
    assert.deepEqual(p.inventory, { bread: 2 });
  }
});
test('loss removes hold and tuning cannot invalidate active, moored or stranded freight', () => {
  for (const state of ['active', 'moored', 'stranded']) {
    const { w, p, d } = freightSetup();
    (p as any).boatHold = { stone: 100 };
    if (state === 'moored') act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
    if (state === 'stranded') {
      Object.assign(p, { x: 0, z: 1000, fuel: 0 });
      rescueAction(w, p, 'launch');
    }
    assert.throws(
      () => act(w, p.id, { type: 'vehicleTuning', slot: 35, holdCapacity: 1 }),
      /cargo|hold|unload/i,
    );
    assert.throws(
      () => act(w, p.id, { type: 'vehicleTuning', slot: 35, cargoKind: 'logs' }),
      /cargo|hold|unload/i,
    );
    w.settings.loseBoatsOnDeath = true;
    abandonBoatOnDeath(w, p, w.time);
    assert.equal((p as any).boatHold, undefined);
    assert.equal(w.mooredBoats?.[p.id + ':35'], undefined);
    assert.equal(w.boatRescues?.[p.id], undefined);
  }
});
test('moored freight exports to the new world owner without player or active inventory', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p, d } = freightSetup();
  (p as any).boatHold = { stone: 100 };
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  const design = exportDesign(w);
  const fresh = createWorld('imported-freight', 'Imported', 'recipient');
  applyDesign(fresh, design);
  addPlayer(fresh, 'recipient', 'Recipient');
  assert.deepEqual((fresh.mooredBoats?.['recipient:35'] as any)?.cargo, { stone: 100 });
  assert.equal(fresh.mooredBoats?.['owner:35'], undefined);
  assert.ok(fresh.players.recipient.fleet?.includes(35));
  assert.equal(fresh.players.owner, undefined);
});
test('snapshots keep exact freight private and expose only a load fraction for rendering', async () => {
  const { prepareFrame, privatePlayer } = await import('../src/server/snapshots');
  const { w, p, d } = freightSetup();
  p.boatHold = { stone: 123 };
  p.boatHoldLife = { young: [{ item: 'calves', count: 1, born: 0, grownDays: 12 }] };
  const frame = prepareFrame(w);
  const publicPlayer = JSON.parse(frame.players[p.id]);
  assert.equal(publicPlayer.boatHold, undefined);
  assert.equal(publicPlayer.freightLoad, 0.2);
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  const moored = JSON.parse(prepareFrame(w).fields.mooredBoats)[p.id + ':35'];
  assert.equal(moored.cargo, undefined);
  assert.equal(
    moored.cargoLife,
    undefined,
    'private freight ages must not expose the hold contents',
  );
  assert.equal(moored.load, 0.2);
  assert.deepEqual((privatePlayer(w, p) as any).boatHolds[35], { stone: 123 });
});
test('pier mooring and an actual SQLite reopen preserve freight and acquisition basis', async () => {
  const { Store } = await import('../src/server/store');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { w, p } = freightSetup(),
    pier = boatLandings(w).find((d) => !d.building && !d.river)!;
  Object.assign(p, pier.berth, {
    heading: pier.heading,
    boatHold: { stone: 100 },
    boatHoldBasis: { stone: 60000 },
  });
  act(w, p.id, { type: 'vehicle', slot: 5, building: pier.id });
  const dir = mkdtempSync(join(tmpdir(), 'freight-restart-'));
  try {
    let store = new Store(join(dir, 'world.sqlite'));
    store.saveWorld(w);
    store.db.close();
    store = new Store(join(dir, 'world.sqlite'));
    const loaded = store.loadWorlds()[0].world;
    store.db.close();
    assert.deepEqual(loaded.mooredBoats![p.id + ':35'].cargo, { stone: 100 });
    act(loaded, p.id, { type: 'vehicle', slot: 35, building: pier.id });
    assert.deepEqual(loaded.players[p.id].boatHold, { stone: 100 });
    assert.deepEqual(loaded.players[p.id].boatHoldBasis, { stone: 60000 });
    act(loaded, p.id, {
      type: 'boatHold',
      slot: 35,
      operation: 'unload',
      item: 'stone',
      quantity: 10,
    });
    advance(loaded, 2);
    assert.equal(loaded.players[p.id].inventory.stone, 10);
    assert.equal(loaded.players[p.id].boatHold?.stone, 90);
    assert.equal(loaded.players[p.id].boatHoldBasis?.stone, 54000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('portable designs include the author’s moored freight without copying other players’ private loads', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p, d } = freightSetup();
  p.boatHold = { stone: 10 };
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  w.mooredBoats!['other:35'] = {
    ...w.mooredBoats![p.id + ':35'],
    owner: 'other',
    cargo: { steel: 123 },
  };
  const design = exportDesign(w);
  assert.equal((design as any).mooredFreight.length, 1);
  const fresh = createWorld('freight-private-import', 'Imported', 'recipient');
  applyDesign(fresh, design);
  assert.deepEqual(fresh.mooredBoats!['recipient:35'].cargo, { stone: 10 });
});
test('recoverable cargo and provisions preserve mixed meat ages without duplicating the tender load', async () => {
  const { expireMeat } = await import('../src/shared/meat-freshness');
  for (const death of [false, true]) {
    const { w, p } = freightSetup();
    Object.assign(p, { x: 0, z: 1000, fuel: 0, inventory: { beef: 1 } });
    w.settings.loseBoatsOnDeath = false;
    p.inventoryLife = { meat: [{ item: 'beef', count: 1, agedDays: 1, checkedAt: w.time }] };
    p.boatStores = { pork: 1 };
    p.boatStoresLife = { meat: [{ item: 'pork', count: 1, agedDays: 1, checkedAt: w.time }] };
    if (death) abandonBoatOnDeath(w, p, w.time);
    else rescueAction(w, p, 'launch');
    assert.equal(p.inventoryLife?.meat?.length ?? 0, 0, 'cargo metadata stays with stranded cargo');
    const r = w.boatRescues![p.id];
    Object.assign(p, {
      vehicle: 29,
      x: r.boat.x + 5,
      z: r.boat.z,
      y: 0,
      speed: 0,
      inventory: { beef: 1 },
      inventoryLife: { meat: [{ item: 'beef', count: 1, agedDays: 0, checkedAt: w.time }] },
    });
    rescueAction(w, p, 'reboard');
    w.time += 600;
    expireMeat(w);
    assert.equal(p.inventory.beef, 1, 'only the older stranded portion expires');
    assert.equal(p.boatStores?.pork ?? 0, 0, 'provisions age survives recovery');
  }
});
test('portable moored freight retains young growth and raw-meat age on the recipient clock', async () => {
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { w, p, d } = freightSetup();
  w.time = 5000;
  w.vehicleTuning = {
    ...w.vehicleTuning,
    35: { ...w.vehicleTuning?.[35], cargoKind: 'livestock' },
  };
  p.boatHold = { calves: 1, beef: 2 };
  p.boatHoldLife = {
    young: [{ item: 'calves', count: 1, born: 3000, grownDays: 12, careSince: 5000 }],
    meat: [{ item: 'beef', count: 2, agedDays: 1, checkedAt: 5000 }],
  };
  act(w, p.id, { type: 'vehicle', slot: 5, building: d.id });
  const fresh = createWorld('dated-freight', 'Dated freight', 'recipient');
  applyDesign(fresh, exportDesign(w));
  const life = fresh.mooredBoats!['recipient:35'].cargoLife;
  assert.equal(life?.young?.[0].grownDays, 12);
  assert.equal(life?.young?.[0].born, fresh.time - 2000);
  assert.equal(life?.meat?.[0].agedDays, 1);
  assert.equal(life?.meat?.[0].checkedAt, fresh.time);
});
