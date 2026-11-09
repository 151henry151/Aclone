// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, move, makeBuilding } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { automotiveConfig } from '../src/shared/automotive-config';
import { trailerAction } from '../src/shared/trailers';
import type { Trailer } from '../src/shared/trailers';

function setup(surface: 'paved' | 'dirt' | 'field' = 'paved', loaded = false) {
  const w = createWorld('highway', 'Highway', 'p');
  w.buildings = [];
  w.towns = [];
  w.terrain = [];
  w.creator = creatorSchema.parse({ scenery: false, roads: false });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, { mapSize: 20000, seaLevel: -100, vehicleMaintenance: false });
  const road = { a: { x: 0, z: -5000 }, b: { x: 0, z: 5000 }, width: 8 };
  w.roads = surface === 'field' ? [] : [road];
  if (surface === 'paved') w.pavedRoads = [{ ...structuredClone(road), town: '', kind: 'trunk' }];
  const p = addPlayer(w, 'p', 'Haulier');
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 20,
    heading: 0,
    speed: 0,
    vehicle: 37,
    fleet: [0, 5, 37],
    fuel: 320,
    fuelVehicle: 37,
    engine: true,
    inventory: {},
    online: true,
    skills: ['driver'],
  });
  const t: Trailer = {
    id: 'semi',
    owner: p.id,
    kind: 'semiBox',
    x: 0,
    z: -7.1,
    heading: 0,
    cargo: loaded ? { steel: 1500 } : {},
    attached: p.id,
  };
  w.trailers = { semi: t };
  return { w, p, t };
}
const drive = (
  w: ReturnType<typeof createWorld>,
  p: ReturnType<typeof addPlayer>,
  seconds: number,
  steer = 0,
  throttle = 1,
  boost = false,
) => {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) move(w, p, { throttle, steer, boost }, 0.05);
};
test('loaded and empty highway rigs reach road targets without boost, and crawl off-road', () => {
  for (const surface of ['paved', 'dirt', 'field'] as const)
    for (const loaded of [false, true]) {
      const { w, p } = setup(surface, loaded);
      drive(w, p, 90);
      const target = surface === 'paved' ? 29.0576 : surface === 'dirt' ? 20.1168 : 1.4;
      assert.ok(
        Math.abs(p.speed - target) < 0.15,
        `${surface}/${loaded}: ${p.speed}, expected ${target}`,
      );
      drive(w, p, 5, 0, 1, true);
      assert.ok(p.speed <= target + 0.01, 'Boost cannot exceed road speed');
    }
});
test('the whole rig must fit continuous pavement, including the trailer and narrow/gapped strips', async () => {
  const { highwaySurface } = await import('../src/shared/highway-driving');
  const { w, p, t } = setup();
  assert.equal(highwaySurface(w, p).kind, 'paved');
  w.pavedRoads![0].width = 1;
  assert.equal(highwaySurface(w, p).kind, 'dirt');
  w.pavedRoads![0].width = 8;
  w.pavedRoads![0].a.z = -2;
  assert.equal(highwaySurface(w, p).kind, 'dirt', 'Trailer remains on dirt');
  w.pavedRoads = [
    { a: { x: 0, z: -20 }, b: { x: 0, z: -2 }, width: 3, town: '', kind: 'trunk' },
    { a: { x: 0, z: 3 }, b: { x: 0, z: 20 }, width: 3, town: '', kind: 'trunk' },
  ];
  assert.equal(highwaySurface(w, p).kind, 'dirt', 'Gap cannot be bridged by two centre samples');
  t.x = 8;
  assert.equal(highwaySurface(w, p).kind, 'field');
});
test('full load slows acceleration; braking and signed reverse remain controllable', () => {
  const empty = setup(),
    loaded = setup('paved', true);
  drive(empty.w, empty.p, 5);
  drive(loaded.w, loaded.p, 5);
  assert.ok(loaded.p.speed < empty.p.speed * 0.7);
  const before = empty.p.speed;
  for (let i = 0; i < 10; i++)
    move(empty.w, empty.p, { throttle: 0, steer: 0, boost: false, brake: true }, 0.05);
  assert.ok(empty.p.speed < before - 2.5);
  drive(empty.w, empty.p, 10, 0, -1);
  assert.ok(empty.p.speed >= -3.01 && empty.p.speed < -2.9);
});
test('only the compatible fifth wheel couples, and ownership plus alignment are enforced', () => {
  const { w, p, t } = setup();
  delete t.attached;
  trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id });
  assert.equal(t.attached, p.id);
  trailerAction(w, p, { type: 'trailer', operation: 'unhitch', id: t.id });
  p.vehicle = 0;
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /highway|compatible/i,
  );
  p.vehicle = 37;
  t.kind = 'box';
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /agricultural|compatible/i,
  );
});
test('a long trailer cannot sweep into a parked vehicle after the tractor has cleared it', () => {
  const { w, p, t } = setup();
  w.parkedVehicles = {
    obstacle: {
      owner: 'other',
      slot: 0,
      x: 1.7,
      z: -16.4,
      y: 20,
      heading: 0,
      fuel: 0,
      condition: 100,
      parkedAt: 0,
    },
  };
  const start = { x: p.x, z: p.z };
  p.speed = -3;
  move(w, p, { throttle: -1, steer: 0, boost: false }, 0.5);
  assert.deepEqual({ x: p.x, z: p.z }, start);
  assert.equal(p.fleetState?.[37]?.metres ?? 0, 0);
  assert.equal(t.z, -7.1);
});
test('custom driving rules are applied and survive portable world designs', async () => {
  const { w, p } = setup('field');
  act(w, p.id, {
    type: 'automotiveConfig',
    patch: { driving: { offRoadSpeed: 2, reverseSpeed: 1 } },
  });
  drive(w, p, 10);
  assert.ok(Math.abs(p.speed - 2) < 0.05);
  drive(w, p, 10, 0, -1);
  assert.ok(Math.abs(p.speed + 1) < 0.05);
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  delete w.trailers!.semi.attached;
  act(w, p.id, {
    type: 'automotiveConfig',
    patch: {
      coupling: { fifthWheelZ: -1.8 },
      refrigeration: { fuelPerHour: 2, ageingMultiplier: 0.4 },
    },
  });
  act(w, p.id, { type: 'vehicleTuning', slot: 37, tuning: { height: 4.5 } });
  const imported = createWorld('imported-highway', 'Imported highway', 'p');
  w.settings.seaLevel = -50; // Use a valid portable setting, rather than the isolated physics fixture's -100.
  applyDesign(imported, exportDesign(w));
  assert.deepEqual(imported.automotive, w.automotive);
  assert.deepEqual(imported.vehicleTuning, w.vehicleTuning);
  assert.deepEqual(imported.trailers ?? {}, {});
});

test('reverse a separated highway tractor under its own parked kingpin, couple and pull away', async () => {
  const { fifthWheel, kingpin } = await import('../src/shared/highway-geometry');
  const { w, p, t } = setup();
  delete t.attached;
  p.z = 7;
  // Start with disjoint physical bodies, then actually reverse into the fifth-wheel approach.
  for (
    let i = 0;
    i < 400 &&
    Math.hypot(fifthWheel(w, p).x - kingpin(w, t).x, fifthWheel(w, p).z - kingpin(w, t).z) > 0.5;
    i++
  )
    move(w, p, { throttle: -0.3, steer: 0, boost: false }, 0.05);
  assert.ok(
    Math.abs(fifthWheel(w, p).z - kingpin(w, t).z) <= 0.5,
    `Fifth wheel stopped ${Math.abs(fifthWheel(w, p).z - kingpin(w, t).z)}m from kingpin`,
  );
  p.speed = 0;
  trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id });
  drive(w, p, 3);
  assert.equal(t.attached, p.id);
  assert.ok(p.z > 3);
  assert.ok(
    Math.hypot(fifthWheel(w, p).x - kingpin(w, t).x, fifthWheel(w, p).z - kingpin(w, t).z) < 1e-7,
  );
});

test('coupling clearance does not let the cab or a broadside tractor pass through a parked semitrailer', () => {
  for (const heading of [0, Math.PI / 2]) {
    const { w, p, t } = setup();
    delete t.attached;
    p.z = 7;
    p.heading = heading;
    if (heading) {
      p.x = -10;
      p.z = t.z;
    }
    drive(w, p, 20, 0, heading ? 1 : -1);
    if (heading) assert.ok(p.x < -4, `Broadside collision allowed x=${p.x}`);
    else assert.ok(p.z > -1, `Cab penetrated trailer at z=${p.z}`);
  }
});

test('forward and reverse turns retain the coupled kingpin and persist the rig when parking and restarting', async () => {
  const { fifthWheel, kingpin } = await import('../src/shared/highway-geometry');
  const { Store } = await import('../src/server/store');
  const { w, p, t } = setup('field', true);
  w.settings.vehiclesPersist = true;
  for (const [throttle, steer] of [
    [1, 0.3],
    [-1, -0.2],
    [1, -0.3],
  ]) {
    const before = { x: p.x, z: p.z };
    drive(w, p, 5, steer, throttle);
    assert.ok(Math.hypot(p.x - before.x, p.z - before.z) > 1);
    assert.ok(
      Math.hypot(fifthWheel(w, p).x - kingpin(w, t).x, fifthWheel(w, p).z - kingpin(w, t).z) < 1e-7,
    );
  }
  p.speed = 0;
  const pose = { x: t.x, z: t.z, heading: t.heading };
  act(w, p.id, { type: 'vehicle', slot: 5 });
  assert.equal(t.parkedWith, `${p.id}:37`);
  assert.deepEqual({ x: t.x, z: t.z, heading: t.heading }, pose);
  const db = new Store(':memory:');
  try {
    db.saveWorld(w);
    const loaded = db.loadWorlds()[0].world;
    assert.deepEqual(loaded.trailers![t.id], t);
    assert.deepEqual(loaded.parkedVehicles, JSON.parse(JSON.stringify(w.parkedVehicles)));
  } finally {
    db.close();
  }
});

test('full cab collision respects the world vehicle collision switch', () => {
  for (const mode of ['off', 'stop-only'] as const) {
    const { w, p } = setup('field');
    w.trailers = {};
    w.settings.vehicleCollision = mode;
    w.parkedVehicles = {
      obstacle: {
        owner: 'other',
        slot: 0,
        x: 0,
        z: 7,
        y: 20,
        heading: 0,
        fuel: 0,
        condition: 100,
        parkedAt: 0,
      },
    };
    drive(w, p, 10);
    assert.ok(mode === 'off' ? p.z > 10 : p.z < 3, `${mode}: ${p.z}`);
  }
});

test('client prediction uses its private articulated pose and agrees with server turning without mutating the snapshot', () => {
  const server = setup('field');
  const snapshot = structuredClone(server.w),
    prediction = structuredClone(server.p),
    before = structuredClone(snapshot);
  for (let i = 0; i < 600; i++) {
    const input = { throttle: 1, steer: 0.5, boost: false };
    move(server.w, server.p, input, 0.05);
    move(snapshot, prediction, input, 0.05, true);
  }
  assert.ok(
    Math.hypot(server.p.x - prediction.x, server.p.z - prediction.z) < 1e-7,
    `Prediction drift ${Math.hypot(server.p.x - prediction.x, server.p.z - prediction.z)}m`,
  );
  assert.deepEqual(snapshot, before);
});

test('a loaded highway rig crosses the built wide bridge with the entire trailer and stops at narrow rails', async () => {
  const { completedBridgeSite } = await import('./fixtures/bridge-site');
  const { travelHeight } = await import('../src/shared/dock');
  const { fifthWheel, kingpin } = await import('../src/shared/highway-geometry');
  const { w, bridge } = completedBridgeSite();
  const dx = bridge.b.x - bridge.a.x,
    dz = bridge.b.z - bridge.a.z,
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const p = addPlayer(w, 'p', 'Haulier');
  Object.assign(p, {
    x: bridge.approachA.x - ux * 20,
    z: bridge.approachA.z - uz * 20,
    heading: Math.atan2(dx, dz),
    vehicle: 37,
    engine: true,
    fuel: 320,
    fuelVehicle: 37,
    speed: 0,
    inventory: {},
    online: true,
  });
  p.y = travelHeight(w, p.x, p.z);
  const offset =
    automotiveConfig(w).semitrailers.box.length / 2 -
    automotiveConfig(w).coupling.kingpinInset -
    automotiveConfig(w).coupling.fifthWheelZ;
  const t: Trailer = {
    id: 'bridge-semi',
    kind: 'semiBox',
    owner: p.id,
    attached: p.id,
    x: p.x - ux * offset,
    z: p.z - uz * offset,
    heading: p.heading,
    cargo: { steel: 1500 },
  };
  w.trailers = { [t.id]: t };
  let crossed = false;
  for (let i = 0; i < 5000; i++) {
    move(w, p, { throttle: 1, steer: 0, boost: false }, 0.05);
    if ((t.x - bridge.approachB.x) * ux + (t.z - bridge.approachB.z) * uz > 8) {
      crossed = true;
      break;
    }
  }
  assert.ok(
    crossed,
    `Tractor ended ${((p.x - bridge.approachA.x) * ux + (p.z - bridge.approachA.z) * uz).toFixed(2)}m from approach A, speed ${p.speed}`,
  );
  assert.deepEqual(t.cargo, { steel: 1500 });
  assert.ok(
    Math.hypot(fifthWheel(w, p).x - kingpin(w, t).x, fifthWheel(w, p).z - kingpin(w, t).z) < 1e-6,
  );
  const { clearHighwayRig } = await import('../src/shared/highway-driving');
  bridge.width = 2.5;
  const from = {
    x: bridge.approachA.x - ux * 5,
    z: bridge.approachA.z - uz * 5,
    heading: p.heading,
  };
  const to = { x: bridge.a.x, z: bridge.a.z, heading: p.heading };
  assert.equal(clearHighwayRig(w, p, from, to), false);
});

test('the full trailer body rejects narrow gate posts between footprint samples but passes an adequate gap', () => {
  for (const gap of [0.8, 2.4, 3]) {
    const { w, p, t } = setup('field');
    w.creator = creatorSchema.parse({
      scenery: false,
      roads: false,
      objects: [-1, 1].map((side) => ({
        id: side < 0 ? 'left' : 'right',
        name: 'Gate post',
        model: 'post',
        x: side * (gap / 2 + 0.2),
        z: -16,
        y: 0,
        radius: 0.2,
        scale: 1,
        solid: true,
        visible: true,
      })),
    });
    drive(w, p, 5, 0, -1);
    assert.ok(gap < 2.6 ? t.z > -9.5 : t.z < -11, `Gate ${gap}m: trailer z=${t.z}`);
  }
});

test('a thin lengthwise fence cannot hide between the trailer centre and edge samples', () => {
  const { w, p, t } = setup('field');
  w.landscape!.barriers = [
    {
      id: 'rail',
      kind: 'fence',
      height: 1.5,
      width: 0.2,
      points: [
        { x: 0.6, z: -16 },
        { x: 0.6, z: -17 },
      ],
    },
  ];
  drive(w, p, 5, 0, -1);
  assert.ok(t.z > -9.5, `Fence passed through the trailer at z=${t.z}`);
});

test('coupling edits refuse to move a hitched load and highway mode stays on the ground', () => {
  const { w, p } = setup();
  const before = structuredClone(w);
  assert.throws(
    () => act(w, p.id, { type: 'automotiveConfig', patch: { coupling: { fifthWheelZ: -2 } } }),
    /unhitch/i,
  );
  assert.deepEqual(w, before);
  assert.throws(
    () =>
      act(w, p.id, { type: 'automotiveConfig', patch: { semitrailers: { box: { length: 15 } } } }),
    /unhitch/i,
  );
  assert.deepEqual(w, before);
});

test('highway vehicle tuning retains a compatible ground movement mode', () => {
  const { w, p } = setup();
  p.vehicle = 5;
  assert.throws(
    () => act(w, p.id, { type: 'vehicleTuning', slot: 37, tuning: { mode: 2 } }),
    /highway|ground/i,
  );
});

test('a custom forward fifth wheel cannot reverse a semitrailer through the cab', async () => {
  const T = await import('three');
  const { createHighwayTractor } = await import('../src/client/highway-model');
  const { rectAt } = await import('../src/shared/highway-geometry');
  const { rectanglesOverlap, trailerFootprint } = await import('../src/shared/vehicle-footprint');
  const { w, p, t } = setup('paved');
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.coupling.fifthWheelZ = -1;
  t.z += 0.5;
  const model = createHighwayTractor(w);
  const bounds = new T.Box3().setFromObject(model.getObjectByName('cab')!);
  const centre = bounds.getCenter(new T.Vector3()),
    size = bounds.getSize(new T.Vector3());
  let stopped = false;
  for (let i = 0; i < 1000; i++) {
    move(w, p, { throttle: -1, steer: 1, boost: false }, 0.05);
    const cab = rectAt(
      {
        x: p.x + Math.sin(p.heading) * centre.z,
        z: p.z + Math.cos(p.heading) * centre.z,
        heading: p.heading,
      },
      size.z,
      size.x,
    );
    assert.equal(
      rectanglesOverlap(cab, trailerFootprint(t, w)),
      false,
      'The coupled trailer must not enter the actual cab shell',
    );
    if (i > 100 && p.speed === 0) {
      stopped = true;
      break;
    }
  }
  assert.ok(stopped, 'The reverse manoeuvre must stop at its own cab');
});

test('terrain grade and suspension allowances are configurable and validated world rules', async () => {
  const { clearHighwayBody } = await import('../src/shared/highway-geometry');
  const { automotiveEditor } = await import('../src/client/automotive-panel');
  const { w, p } = setup('field');
  w.settings.mapSize = 500;
  w.landscape!.heightmap = Array.from(
    { length: 1089 },
    (_, i) => 100 + (Math.floor(i / 33) / 32 - 0.5) * 500 * 0.5,
  );
  const from = { x: 0, z: 0, heading: 0 },
    to = { x: 0, z: 1, heading: 0 };
  const clear = () => clearHighwayBody(w, from, to, 6.4, 2.55, 3.75, p.id, 'semi');
  assert.equal(clear(), true);
  act(w, p.id, {
    type: 'automotiveConfig',
    patch: { driving: { maximumTerrainGrade: 0.1, suspensionTravel: 0 } },
  });
  assert.equal(clear(), false);
  act(w, p.id, { type: 'automotiveConfig', patch: { driving: { suspensionTravel: 2 } } });
  assert.equal(clear(), true);
  assert.match(automotiveEditor(w), /name="maximumTerrainGrade"/);
  assert.match(automotiveEditor(w), /name="suspensionTravel"/);
  const before = structuredClone(w);
  assert.throws(() =>
    act(w, p.id, { type: 'automotiveConfig', patch: { driving: { maximumTerrainGrade: -1 } } }),
  );
  assert.deepEqual(w, before);
});

test('coupling rejects a world geometry that would place the trailer nose inside the cab', () => {
  const { w, p, t } = setup('field');
  delete t.attached;
  w.automotive = structuredClone(automotiveConfig(w));
  w.automotive.coupling.fifthWheelZ = 0;
  const before = structuredClone(w);
  // This pickup is within the allowed reach, but snapping the kingpin to the
  // forward fifth wheel would put the front wall through the occupied cab.
  p.z = -1;
  t.z = -6.6;
  const saved = structuredClone({ p, t });
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /cab|clear/i,
  );
  assert.deepEqual({ p, t }, saved);
  assert.deepEqual(w.automotive, before.automotive);
});

test('full semitrailer sweep respects solid trees and world water-depth limits', async () => {
  const { clearTrailer } = await import('../src/shared/trailers');
  const { sceneryChunk } = await import('../src/shared/scenery-obstacles');
  const { roadRules } = await import('../src/shared/road-rules');
  const { w, p, t } = setup('field');
  delete t.attached;
  w.creator!.scenery = true;
  w.terrainMapSize = 2000;
  w.settings.mapSize = 2000;
  const tree = Array.from({ length: 7 }, (_, i) => i - 3)
    .flatMap((i) => Array.from({ length: 7 }, (_, j) => sceneryChunk(w, i, j - 3)).flat())
    .find((o) => o.kind === 'tree');
  assert.ok(tree);
  t.x = tree.x - 8;
  t.z = tree.z;
  t.heading = 0;
  const to = { x: tree.x + 8, z: tree.z, heading: 0 };
  assert.equal(
    clearTrailer(w, t, to),
    false,
    'A real procedural trunk blocks the entire sideways sweep',
  );
  w.settings.solidScenery = 'off';
  assert.equal(
    clearTrailer(w, t, to),
    true,
    'Turning solid scenery off permits the identical sweep',
  );
  w.settings.seaLevel = 20 + roadRules(w.settings).groundWaterDepth + 0.1;
  assert.equal(clearTrailer(w, t, to), false, 'Deep water blocks the whole trailer');
  w.settings.seaLevel = 20.05;
  assert.equal(clearTrailer(w, t, to), true, 'A shallow flooded ford remains usable');
  w.settings.seaLevel = 22;
  Object.assign(t, { x: 0, z: -7.1, attached: p.id });
  const before = { x: p.x, z: p.z, fuel: p.fuel };
  drive(w, p, 1);
  assert.deepEqual(
    { x: p.x, z: p.z, fuel: p.fuel },
    before,
    'No movement or travel fuel is charged for a deep-water refusal',
  );
});

test('resident travel keeps a fueled highway tractor and navigates a loaded rig without teleporting or switching vehicles', async () => {
  const { Navigator } = await import('../src/server/npc/navigation');
  const { travelPrep } = await import('../src/server/npc/travel');
  const { w, p, t } = setup('paved', true);
  const prep = travelPrep(p, w, { kind: 'move', x: 0, z: 120 });
  assert.ok(
    !prep.some(
      (s) =>
        (s.kind === 'act' && s.action.type === 'vehicle') ||
        (s.kind === 'operation' && s.operation === 'vehicle'),
    ),
    'Keep the actual truck instead of replacing it with tractor 0',
  );
  const nav = new Navigator(w, p, { x: 0, z: 120 }, 3, true);
  let arrived = false;
  for (let i = 0; i < 4000; i++) {
    const result = nav.step(w, p, 0.05);
    assert.equal(result.error, undefined);
    if (result.arrived) {
      arrived = true;
      break;
    }
    move(w, p, result.input, 0.05);
  }
  assert.ok(arrived, 'A loaded rig must reach and stop at the delivery approach');
  assert.equal(p.vehicle, 37);
  assert.ok(p.z > 116 && p.z < 124);
  assert.ok(Math.abs(p.speed) < 0.2);
  assert.equal(t.cargo.steel, 1500);
});
