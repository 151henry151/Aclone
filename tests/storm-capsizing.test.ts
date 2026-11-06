// SPDX-License-Identifier: GPL-3.0-or-later
import { creatorSchema } from '../src/shared/creator';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, act, move } from '../src/shared/simulation';
import {
  capsizeRisk,
  advanceCapsizing,
  stormRoll,
  escapeAllowance,
} from '../src/shared/storm-capsizing';
import { stormRules } from '../src/shared/storm-rules';
import { oceanWeather } from '../src/shared/ocean';
import { vehicleDef } from '../src/shared/vehicle-config';
function setup(slot = 36) {
  const w = createWorld('storm-test', 'Storm', 'owner');
  w.buildings = [];
  Object.assign(w.settings, {
    seaLevel: 0,
    tidalRange: 0,
    oceanWaves: 1,
    hungerRate: 0,
    thirstRate: 0,
    vehicleMaintenance: false,
  });
  w.settings.mapSize = 10000;
  w.terrainMapSize = 10000;
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array.from({ length: 1089 }, (_, i) => (16 - (i % 33)) * 100),
  };
  w.creator = creatorSchema.parse({ weather: 'thunderstorm' });
  const p = addPlayer(w, 'owner', 'Rower');
  Object.assign(p, {
    x: 400,
    z: 0,
    y: 0,
    heading: 0,
    vehicle: slot,
    fleet: [0, 5, slot],
    speed: 0,
    online: true,
    inventory: { wood: 2 },
    fuel: 50,
    engine: true,
  });
  return { w, p };
}
test('storm flag and exposed sea required; ordinary bay storm threatens small craft only', () => {
  const { w, p } = setup();
  assert.ok(capsizeRisk(w, p).rate > 0);
  for (const slot of [3, 33, 30, 31, 32, 35]) {
    p.vehicle = slot;
    assert.equal(capsizeRisk(w, p).rate, 0);
  }
  p.vehicle = 36;
  w.creator!.weather = 'clear';
  assert.equal(capsizeRisk(w, p).rate, 0);
  w.creator!.weather = 'rain';
  assert.equal(capsizeRisk(w, p, { storm: false, amplitude: 4 }).rate, 0);
  p.x = 5;
  w.creator = creatorSchema.parse({ weather: 'thunderstorm' });
  assert.equal(capsizeRisk(w, p).rate, 0);
});
test('motor and canal boats require both true ocean and large storm, with configurable thresholds', () => {
  const { w, p } = setup(33);
  p.x = 2000;
  assert.equal(capsizeRisk(w, p, { storm: true, amplitude: 1.6 }).rate, 0);
  assert.ok(capsizeRisk(w, p, { storm: true, amplitude: 2 }).rate > 0);
  p.vehicle = 3;
  assert.ok(capsizeRisk(w, p, { storm: true, amplitude: 2 }).rate > 0);
  w.settings.capsizeOceanDepth = 1000;
  assert.equal(capsizeRisk(w, p, { storm: true, amplitude: 2 }).rate, 0);
  w.settings.capsizeOceanDepth = 50;
  w.settings.capsizeEnabled = false;
  assert.equal(capsizeRisk(w, p, { storm: true, amplitude: 2 }).rate, 0);
});
test('world rules and per-vessel susceptibility validate and affect the same risk function', () => {
  const { w, p } = setup(35);
  assert.equal(capsizeRisk(w, p).rate, 0);
  act(w, p.id, { type: 'vehicleTuning', slot: 35, stormClass: 'small' });
  assert.ok(capsizeRisk(w, p).rate > 0);
  act(w, p.id, { type: 'settings', patch: { capsizeSmallRate: 0 } });
  assert.equal(capsizeRisk(w, p).rate, 0);
  assert.throws(() => act(w, p.id, { type: 'settings', patch: { capsizeRampSeconds: -1 } }));
  assert.throws(() => act(w, p.id, { type: 'vehicleTuning', slot: 35, stormClass: 'random' }));
});
test('deterministic rolls and exposure survive partitioned cadence and restart', () => {
  assert.equal(stormRoll('seed', 'owner', 36, 10), stormRoll('seed', 'owner', 36, 10));
  assert.notEqual(stormRoll('seed', 'owner', 36, 10), stormRoll('seed', 'owner', 36, 11));
  const { w, p } = setup();
  const copy = structuredClone(w);
  let losses = 0;
  advanceCapsizing(w, 0, 60, () => losses++);
  for (let t = 0; t < 60; t++) advanceCapsizing(copy, t, t + 1, () => losses++);
  assert.deepEqual(w.players[p.id].stormExposure, copy.players[p.id].stormExposure);
  assert.equal(losses, 0);
  assert.equal(w.messages.filter((m) => m.name === 'Storm warning').length, 1);
  const saved = structuredClone(w);
  advanceCapsizing(w, 60, 120, () => losses++);
  advanceCapsizing(saved, 60, 120, () => losses++);
  assert.deepEqual(w.players[p.id].stormExposure, saved.players[p.id].stormExposure);
});
test('a prompt return reaches shore before the guaranteed escape allowance at every small hull speed', () => {
  for (const slot of [29, 34, 36]) {
    const { w, p } = setup(slot);
    p.heading = -Math.PI / 2;
    p.fuel = 0;
    const allowance = escapeAllowance(w, p, capsizeRisk(w, p));
    let seconds = 0;
    while (p.x > 12 && seconds < allowance) {
      move(w, p, { throttle: 1, steer: 0, boost: false }, 0.2);
      seconds += 0.2;
    }
    assert.ok(p.x <= 12, `${vehicleDef(w, slot).name} returns within ${allowance}s; x=${p.x}`);
  }
});
test('capsizing kills all aboard once; small craft follow recovery but coastal hulls are destroyed', () => {
  for (const slot of [36, 33, 3])
    for (const lose of [false, true]) {
      const { w, p } = setup(slot);
      p.x = 2000;
      w.settings.oceanWaves = 2;
      w.settings.loseBoatsOnDeath = lose;
      Object.assign(w.settings, {
        capsizeGraceSeconds: 0,
        capsizeEscapeMultiplier: 0,
        capsizeTurnSeconds: 0,
        capsizeRampSeconds: 0,
        capsizeSmallRate: 1,
        capsizeCoastalRate: 1,
      });
      const q = addPlayer(w, 'q', 'Passenger');
      Object.assign(q, {
        vehicle: 5,
        hitch: p.id,
        x: p.x,
        z: p.z,
        y: 2,
        inventory: { wood: 1 },
        online: true,
      });
      advance(w, 10);
      assert.equal(p.deaths, 1);
      assert.equal(q.deaths, 1);
      assert.equal(q.hitch, undefined);
      assert.equal(!!w.boatRescues?.[p.id], slot === 36 && !lose);
      if (slot !== 36 || lose) {
        assert.ok(!p.fleet!.includes(slot));
        assert.equal(p.inventory.wood, undefined);
      }
      assert.ok(
        w.messages.some(
          (m) => /capsiz/i.test(m.text) && /2000/.test(m.text) && /amplitude/i.test(m.text),
        ),
      );
    }
});

import { settingsFields } from '../src/client/creator-editor';
import { vehicleEditor } from '../src/client/vehicle-editor';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { coastClearance } from '../src/shared/coast-clearance';
import { marineSafetyPanel } from '../src/client/marine-safety-panel';
test('all storm controls are visible and portable; the safety panel explains exposure', () => {
  const { w, p } = setup();
  assert.match(settingsFields(w.settings), /name="capsizeEnabled"/);
  assert.match(settingsFields(w.settings), /name="capsizeOceanShore"/);
  assert.match(vehicleEditor(w, 36), /name="stormClass"/);
  act(w, p.id, { type: 'settings', patch: { capsizeOceanShore: 2200, capsizeSmallRate: 0.03 } });
  const target = createWorld('import', 'Import', 'q');
  const design = exportDesign(w);
  delete design.landscape;
  applyDesign(target, design);
  assert.equal(stormRules(target.settings).capsizeOceanShore, 2200);
  advanceCapsizing(w, 0, 5, () => assert.fail('no loss during grace'));
  assert.match(marineSafetyPanel(w, p), /Storm|storm/);
  assert.match(marineSafetyPanel(w, p), /escape|shelter/);
});
test('real generated rivers and ponds are immune even in extreme storms', () => {
  const { w, p } = setup();
  w.id = 'puddlewick';
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  delete w.landscape;
  expandPuddlewickIsland(w);
  const river = w.northernIsland!.rivers[0].points[5],
    pond = w.northernIsland!.ponds[0];
  for (const place of [river, pond])
    for (const slot of [29, 34, 36, 3, 33]) {
      Object.assign(p, place, { vehicle: slot });
      assert.equal(capsizeRisk(w, p, { storm: true, amplitude: 8 }).rate, 0);
    }
});
test('coast classification stays conservative in the surveyed bay and caches repeated queries', () => {
  const w = createWorld('puddlewick', 'Coast', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  const p = addPlayer(w, 'owner', 'Captain');
  Object.assign(p, { vehicle: 33, x: 0, z: 3000, y: 0 });
  assert.equal(capsizeRisk(w, p, { storm: true, amplitude: 3 }).rate, 0);
  const first = performance.now();
  const coast = coastClearance(w, p);
  const cold = performance.now() - first;
  const start = performance.now();
  for (let i = 0; i < 1000; i++) coastClearance(w, p);
  const warm = performance.now() - start;
  console.log('COAST_QUERY_MS', JSON.stringify({ cold, warm1000: warm, ...coast }));
  assert.ok(warm < 100, 'cached queries must not rescan or serialize the whole island');
});
test('warning precedes a natural storm and no risk occurs in the guaranteed escape period', () => {
  const { w, p } = setup();
  w.creator!.weather = 'natural';
  let onset = 0;
  for (let t = 5; t < 30000; t += 5) {
    if (oceanWeather({ ...w, time: t }).storm && !oceanWeather({ ...w, time: t - 5 }).storm) {
      onset = t;
      break;
    }
  }
  assert.ok(onset > 0);
  const start = Math.max(0, onset - 100);
  let deaths = 0;
  advanceCapsizing(w, start, onset - 5, () => deaths++);
  assert.ok(w.messages.some((m) => m.name === 'Storm warning' && /forecast/i.test(m.text)));
  advanceCapsizing(w, onset - 5, onset + 100, () => deaths++);
  assert.equal(deaths, 0);
});

import { canoePanel } from '../src/client/canoe-panel';
test('canoes expose the same storm warning and sea forecast as other boats', () => {
  const { w, p } = setup(34);
  advanceCapsizing(w, 0, 5, () => assert.fail('escape grace'));
  assert.match(canoePanel(w, p), /data-marine-safety/);
  assert.match(canoePanel(w, p), /escape time/);
});
test('turning allowance is honored even with the travel-time multiplier set to zero', () => {
  const { w, p } = setup();
  Object.assign(w.settings, {
    capsizeGraceSeconds: 0,
    capsizeEscapeMultiplier: 0,
    capsizeTurnSeconds: 20,
  });
  assert.equal(escapeAllowance(w, p, capsizeRisk(w, p)), 20);
});

test('a tiny dry island inside a wide terrain brush does not shorten the escape distance to the brush edge', () => {
  const { w } = setup();
  w.landscape!.heightmap = Array(1089).fill(-20);
  w.terrain = [{ x: 0, z: 0, radius: 1000, height: 21 }];
  w.revision++;
  const p = { x: 2000, z: 0 };
  const coast = coastClearance(w, p);
  assert.ok(
    coast.returnDistance >= 1500,
    `escape must reach actual dry ground, got ${coast.returnDistance}`,
  );
});

import { startVoyage } from '../src/shared/fishing-expedition';
test('a world-authored vulnerable trawler loses both paid deckhands with its captain, without payout', () => {
  const { w, p } = setup(30);
  w.vehicleTuning = { 30: { stormClass: 'small' } };
  Object.assign(w.settings, {
    capsizeSmallRate: 1,
    capsizeGraceSeconds: 0,
    capsizeEscapeMultiplier: 0,
    capsizeTurnSeconds: 0,
    capsizeRampSeconds: 0,
    deathCashRetention: 1,
  });
  const voyage = startVoyage(w, p);
  voyage.departed = true;
  voyage.members = { a: 10, b: 10 };
  for (const id of ['a', 'b'])
    Object.assign(addPlayer(w, id, id), {
      hitch: p.id,
      vehicle: 5,
      x: p.x,
      z: p.z,
      y: 2,
      cash: 123,
      online: true,
    });
  advance(w, 10);
  for (const id of [p.id, 'a', 'b']) assert.equal(w.players[id].deaths, 1);
  assert.equal(p.fishingVoyage, undefined);
  for (const id of ['a', 'b']) {
    assert.equal(w.players[id].hitch, undefined);
    assert.equal(w.players[id].cash, 123);
  }
});
test('turning back in powered and empty-tank coastal hulls reaches shallow shelter during grace', () => {
  for (const slot of [3, 33])
    for (const fuel of [0, 50]) {
      if (slot === 3 && fuel === 0) continue; // Canal boats use the emergency lifeboat, not empty-tank rowing.
      const { w, p } = setup(slot);
      Object.assign(p, { x: 2000, heading: -Math.PI / 2, fuel, skills: ['captain'] });
      w.settings.oceanWaves = 2;
      const risk = capsizeRisk(w, p),
        allowance = escapeAllowance(w, p, risk);
      assert.ok(risk.rate > 0);
      let elapsed = 0;
      while (capsizeRisk(w, p).rate > 0 && elapsed < allowance) {
        move(w, p, { throttle: 1, steer: 0, boost: false }, 1);
        elapsed++;
      }
      assert.equal(
        capsizeRisk(w, p).rate,
        0,
        `${slot}/${fuel} reaches safe coastal water within ${allowance} seconds`,
      );
    }
});

import { Store } from '../src/server/store';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('SQLite close and reopen preserves the storm escape deadline without granting new grace', () => {
  const { w, p } = setup();
  advance(w, 10);
  const exposure = structuredClone(p.stormExposure);
  assert.ok(exposure?.safeUntil);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-storm-save-'));
  let store: Store | undefined;
  try {
    const path = join(dir, 'state.sqlite');
    store = new Store(path);
    store.saveWorld(w);
    store.db.close();
    store = new Store(path);
    const loaded = store.loadWorlds()[0].world;
    assert.deepEqual(loaded.players[p.id].stormExposure, exposure);
    advance(loaded, 10);
    assert.deepEqual(loaded.players[p.id].stormExposure, exposure);
    assert.equal(loaded.players[p.id].deaths, 0);
  } finally {
    store?.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('deep-ocean loss overrides a vessel recovery policy and destroys its separate hold only', () => {
  const { w, p } = setup(33);
  Object.assign(w.settings, {
    loseBoatsOnDeath: false,
    loseInventoryOnDeath: false,
    oceanWaves: 2,
    capsizeCoastalRate: 1,
    capsizeGraceSeconds: 0,
    capsizeEscapeMultiplier: 0,
    capsizeTurnSeconds: 0,
    capsizeRampSeconds: 0,
  });
  w.vehicleTuning = { 33: { deathPolicy: 'recover', holdCapacity: 100, cargoKind: 'box' } };
  Object.assign(p, {
    x: 2000,
    boatHold: { stone: 10 },
    boatHoldBasis: { stone: 500 },
    fleet: [0, 5, 33, 35],
  });
  advance(w, 10);
  assert.equal(p.deaths, 1);
  assert.ok(!p.fleet!.includes(33));
  assert.ok(p.fleet!.includes(35));
  assert.equal(p.boatHold, undefined);
  assert.equal(p.boatHoldBasis, undefined);
  assert.deepEqual(p.inventory, {});
  assert.equal(w.boatRescues?.[p.id], undefined);
});
