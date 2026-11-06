// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act } from '../src/shared/simulation';

test('building door policies have canonical defaults and reject invalid patches atomically', () => {
  const w = createWorld('doors', 'Doors', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  assert.equal((w.settings as any).buildingDoorMode, 'hours');
  assert.equal((w.settings as any).buildingDoorOpenHour, 7);
  assert.equal((w.settings as any).buildingDoorCloseHour, 19);
  assert.equal((w.settings as any).buildingInteriorDetail, 'full');
  for (const patch of [
    { buildingDoorOpenHour: -1 },
    { buildingDoorCloseHour: 25 },
    { buildingDoorMode: 'invalid' },
    { buildingInteriorDetail: 'invalid' },
    { buildingDoorSeconds: 0 },
    { buildingDoorOffsetMinutes: Infinity },
  ]) {
    const before = JSON.stringify(w);
    assert.throws(() => act(w, p.id, { type: 'settings', patch }));
    assert.equal(JSON.stringify(w), before);
  }
});

test('door state follows staff hours, stable staggering, construction and inside occupants', async () => {
  const { doorOpenness, buildingDoorOffset } = await import('../src/shared/building-doors');
  const w = createWorld('doors', 'Doors', 'owner');
  const p = addPlayer(w, 'owner', 'Owner');
  const b = makeBuilding('shop', 'workshop', 0, 0);
  b.owner = p.id;
  b.employees = [p.id];
  w.buildings = [b];
  Object.assign(w.settings, { dayLength: 0, time: 12 * 3600 });
  assert.equal(doorOpenness(w, b), 1);
  w.settings.time = 23 * 3600;
  assert.equal(doorOpenness(w, b), 0);
  p.atHome = true;
  p.home = b.id;
  assert.equal(doorOpenness(w, b), 1);
  b.construction = { wood: 10 };
  assert.equal(doorOpenness(w, b), 0);
  delete b.construction;
  p.atHome = false;
  b.employees = [];
  w.settings.time = 12 * 3600;
  assert.equal(doorOpenness(w, b), 0);
  b.owner = undefined;
  assert.equal(doorOpenness(w, b), 1, 'public town workshop');
  const offsets = new Set(Array.from({ length: 30 }, (_, i) => buildingDoorOffset(w, String(i))));
  assert.ok(offsets.size > 20);
  assert.ok([...offsets].every((n) => Math.abs(n) <= 20 / 60));
  assert.equal(buildingDoorOffset(w, 'shop'), buildingDoorOffset(w, 'shop'));
});

test('custom overnight hours and old-world defaults agree through public snapshots and persistence', async () => {
  const { doorOpenness, buildingDoorFields } = await import('../src/shared/building-doors');
  const { publicBuildings } = await import('../src/server/snapshots');
  const { settingsFields } = await import('../src/client/creator-editor');
  const { exportDesign, applyDesign } = await import('../src/server/world-design');
  const { Store } = await import('../src/server/store');
  const w = createWorld('doors', 'Doors', 'owner'),
    p = addPlayer(w, 'owner', 'Owner'),
    worker = addPlayer(w, 'worker', 'Worker');
  const b = makeBuilding('works', 'warehouse', 0, 0);
  b.owner = p.id;
  worker.job = b.id;
  w.buildings = [b];
  const patch = {
    buildingDoorOpenHour: 22,
    buildingDoorCloseHour: 5,
    buildingDoorOffsetMinutes: 0,
    buildingDoorMode: 'hours',
    buildingDoorSeconds: 4,
    buildingDoorAnimateRange: 90,
    buildingDoorSoundRange: 25,
    buildingDoorSwingDegrees: 100,
    buildingInteriorThreshold: 0.05,
    buildingInteriorDetail: 'reduced',
    buildingDoorUnstaffedClosed: true,
  };
  act(w, p.id, { type: 'settings', patch });
  for (const [hour, expected] of [
    [23, 1],
    [3, 1],
    [8, 0],
  ]) {
    w.settings.time = hour * 3600;
    assert.equal(doorOpenness(w, b), expected);
    const visible = publicBuildings(w)[0];
    assert.equal(doorOpenness({ ...w, players: {} }, visible as any), expected);
  }
  const html = settingsFields(w.settings);
  for (const key of Object.keys(buildingDoorFields)) assert.ok(html.includes(`name="${key}"`), key);
  const dest = createWorld('dest', 'Destination', 'owner');
  applyDesign(dest, exportDesign(w));
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    for (const [key, value] of Object.entries(patch)) {
      assert.equal((loaded.settings as any)[key], value);
      assert.equal((dest.settings as any)[key], value);
    }
  } finally {
    store.close();
  }
  for (const key of Object.keys(buildingDoorFields)) delete (w.settings as any)[key];
  w.settings.time = 12 * 3600;
  assert.equal(doorOpenness(w, b), 1);
});
