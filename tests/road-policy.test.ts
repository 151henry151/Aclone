// SPDX-License-Identifier: GPL-3.0-or-later
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding, addPlayer, act } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { landscapeSchema } from '../src/shared/landscape';
import { growRoads } from '../src/shared/roads';
import { finishRoadGrowth } from './road-work-helpers';
import { exportDesign, applyDesign } from '../src/server/world-design';
import { settingsFields } from '../src/client/creator-editor';

function world() {
  const w = createWorld('road-policy', 'Road policy', 'owner');
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  w.landscape = landscapeSchema.parse({ heightmap: Array(33 * 33).fill(10) });
  w.terrain = [];
  w.buildings = [];
  w.towns = [{ ...w.towns[0], x: 0, z: 0, radius: 200 }];
  w.roads = [{ a: { x: -30, z: 0 }, b: { x: 30, z: 0 }, width: 5 }];
  return w;
}
test('a geometry or permission edit invalidates a yielded survey before any road is laid', () => {
  for (const edit of ['building', 'terrain', 'permission'] as const) {
    const w = world(),
      before = structuredClone(w.roads);
    w.roadProject = {
      kind: 'connection',
      width: 5,
      path: [
        { x: 30, z: 0 },
        { x: 430, z: 0 },
      ],
    };
    let clock = 0;
    const timer = mock.method(performance, 'now', () => (clock += 10));
    try {
      // Exactly one generator step per call, inside the original site's survey.
      for (let i = 0; i < 5; i++) growRoads(w, 0, w.settings.dayLength);
      assert.deepEqual(w.roads, before, 'nothing is built before complete validation');
      assert.equal(w.roadGrowth, 0, 'survey is still pending');
      if (edit === 'building') w.buildings.push(makeBuilding('new-wall', 'warehouse', 60, 0));
      if (edit === 'terrain') w.terrain.push({ x: 60, z: 0, radius: 15, height: 50 });
      if (edit === 'permission') {
        w.towns[0].permissions.residents.roads = false;
        w.towns[0].permissions.guests.roads = false;
      }
      for (let i = 0; i < 1000 && w.roadGrowth < 1; i++) growRoads(w, 0, w.settings.dayLength);
      assert.equal(w.roadGrowth, 1, edit + ' is processed without a stuck job');
      assert.equal(w.roadProject, undefined, edit + ' discards the unsafe plan');
      assert.deepEqual(w.roads, before, edit + ' preserves old roads and lays no unsafe road');
    } finally {
      timer.mock.restore();
    }
  }
});
test('world road growth and width control construction, with zero-rate pause and portable rules', () => {
  const w = world(),
    p = addPlayer(w, 'owner', 'Owner');
  act(w, p.id, { type: 'settings', patch: { roadGrowthPerDay: 3, roadWidth: 4 } });
  w.towns.push({ ...structuredClone(w.towns[0]), id: 'remote', x: 300, z: 0, radius: 30 });
  growRoads(w, 0, w.settings.dayLength);
  finishRoadGrowth(w, w.settings.dayLength);
  const newRoads = w.roads!.slice(1);
  assert.ok(newRoads.length > 0);
  assert.ok(newRoads.every((r) => r.width === 4));
  assert.ok(
    Math.abs(newRoads.reduce((n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), 0) - 3) < 1e-6,
  );
  const project = structuredClone(w.roadProject),
    before = structuredClone(w.roads);
  act(w, p.id, { type: 'settings', patch: { roadGrowthPerDay: 0, roadWidth: 8 } });
  growRoads(w, w.settings.dayLength, w.settings.dayLength * 10);
  finishRoadGrowth(w, w.settings.dayLength * 10);
  assert.deepEqual(w.roads, before);
  assert.deepEqual(w.roadProject, project, 'pause retains the existing project width and path');
  act(w, p.id, { type: 'settings', patch: { roadGrowthPerDay: 3 } });
  growRoads(w, w.settings.dayLength * 10, w.settings.dayLength * 11);
  finishRoadGrowth(w, w.settings.dayLength * 11);
  const added = w.roads!.reduce((n, r) => n + Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), 0) - 60;
  assert.ok(Math.abs(added - 6) < 1e-6, 'resuming adds one day, not nine paused days');
  assert.ok(
    w.roads!.slice(1).every((r) => r.width === 4),
    'unfinished project retains surveyed width',
  );
  const target = createWorld('imported-roads', 'Imported', 'owner');
  applyDesign(target, exportDesign(w));
  assert.equal((target.settings as any).roadGrowthPerDay, 3);
  assert.equal((target.settings as any).roadWidth, 8);
  assert.match(settingsFields(w.settings), /name="roadWidth"/);
  assert.match(settingsFields(w.settings), /name="roadGrowthPerDay"/);
  const settings = structuredClone(w.settings);
  assert.throws(() =>
    act(w, p.id, { type: 'settings', patch: { roadWidth: 0, roadGrowthPerDay: 10 } }),
  );
  assert.deepEqual(w.settings, settings);
});

test('resident observations expose the live road and ground-water policy', async () => {
  const { Store } = await import('../src/server/store');
  const { Universe } = await import('../src/server/universe');
  const { Residents } = await import('../src/server/npc/residents');
  const { npcConfigSchema } = await import('../src/server/npc/config');
  const { observe } = await import('../src/server/npc/observation');
  const store = new Store(':memory:'),
    w = createWorld('puddlewick', 'Road rules', 'server');
  const residents = new Residents(store, new Universe(store), new Map([[w.id, w]]), [
    {
      config: npcConfigSchema.parse({}),
      brain: {
        async decide() {
          throw Error('No network in test');
        },
      },
    },
  ]);
  try {
    Object.assign(w.settings, {
      groundWaterDepth: 0.45,
      roadFords: false,
      roadMaxGrade: 0.2,
      roadGrowthPerDay: 3,
      roadWidth: 4,
    });
    const state = residents.memory.load('mabel')!;
    const rules = observe(
      w,
      w.players[state.playerId],
      state,
      residents.memory,
      'mabel',
    ).worldRules;
    for (const key of [
      'groundWaterDepth',
      'roadFords',
      'roadMaxGrade',
      'roadGrowthPerDay',
      'roadWidth',
    ] as const)
      assert.equal((rules as any)[key], w.settings[key], key + ' is available to residents');
  } finally {
    residents.close();
    store.close();
  }
});
