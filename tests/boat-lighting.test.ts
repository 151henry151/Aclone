// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act } from '../src/shared/simulation';
import { boatLighting, navigationSector, navigationSignals } from '../src/shared/boat-lighting';
import { prepareFrame, privatePlayer } from '../src/server/snapshots';
import { Store } from '../src/server/store';

test('boat switches persist, replicate and remain independent of mandatory navigation lights', () => {
  const w = createWorld('lighting', 'Lighting', 'server'),
    p = addPlayer(w, 'p', 'Skipper');
  Object.assign(p, { vehicle: 30, online: true });
  assert.deepEqual(boatLighting(p), { deck: false, cabin: 'off' });
  act(w, p.id, { type: 'boatLights', circuit: 'deck' });
  act(w, p.id, { type: 'boatLights', circuit: 'cabin' });
  assert.deepEqual(p.boatLighting, { deck: true, cabin: 'warm' });
  act(w, p.id, { type: 'boatLights', circuit: 'search' });
  assert.equal(p.lights, true);
  act(w, p.id, { type: 'boatLights', circuit: 'cabin' });
  assert.equal(p.boatLighting?.cabin, 'red');
  const before = JSON.stringify(p);
  assert.throws(() => act(w, p.id, { type: 'boatLights', circuit: 'navigation' }));
  assert.equal(JSON.stringify(p), before);
  assert.deepEqual(JSON.parse(prepareFrame(w).players[p.id]).boatLighting, p.boatLighting);
  assert.deepEqual(privatePlayer(w, p).boatLighting, p.boatLighting);
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    assert.deepEqual(store.loadWorlds()[0].world.players[p.id].boatLighting, p.boatLighting);
  } finally {
    store.close();
  }
  act(w, p.id, { type: 'boatLights', circuit: 'cabin' });
  assert.equal(p.boatLighting?.cabin, 'off');
  p.hitch = 'someone';
  assert.throws(() => act(w, p.id, { type: 'boatLights', circuit: 'deck' }));
  delete p.hitch;
  p.vehicle = 0;
  assert.throws(() => act(w, p.id, { type: 'boatLights', circuit: 'deck' }));
});
test('navigation sectors distinguish port, starboard, bow and stern even across a heading wrap', () => {
  for (const turn of [-Math.PI * 2, 0, Math.PI * 2]) {
    assert.equal(navigationSector('port', turn - 0.5), true);
    assert.equal(navigationSector('starboard', turn - 0.5), false);
    assert.equal(navigationSector('port', turn + 0.5), false);
    assert.equal(navigationSector('starboard', turn + 0.5), true);
    assert.equal(navigationSector('masthead', turn + 0.5), true);
    assert.equal(navigationSector('masthead', turn + Math.PI), false);
    assert.equal(navigationSector('stern', turn + Math.PI), true);
    assert.equal(navigationSector('stern', turn + 0.5), false);
    assert.equal(navigationSector('trawlGreen', turn + Math.PI), true);
  }
});
test('trawling, making way and moored vessels show different steady signals', () => {
  const underway = navigationSignals(false, 0),
    tow = navigationSignals(true, 2),
    stopped = navigationSignals(true, 0),
    moored = navigationSignals(false, 0, true);
  assert.equal(underway.masthead, true);
  assert.equal(underway.port, true);
  assert.equal(underway.trawlGreen, false);
  assert.equal(tow.trawlGreen, true);
  assert.equal(tow.trawlWhite, true);
  assert.equal(tow.masthead, false);
  assert.equal(tow.stern, true);
  assert.equal(stopped.stern, false);
  assert.equal(stopped.port, false);
  assert.deepEqual(
    Object.entries(moored)
      .filter(([, on]) => on)
      .map(([name]) => name),
    ['trawlWhite'],
  );
});
