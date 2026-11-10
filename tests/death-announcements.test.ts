// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, advance, act } from '../src/shared/simulation';
import { Store } from '../src/server/store';

function setup() {
  const w = createWorld('quiet-deaths', 'Quiet deaths', 'p');
  w.settings.maxOfflineDays = 0;
  const p = addPlayer(w, 'p', 'Absent pilot');
  p.inventory = {};
  return { w, p };
}
function die(w: ReturnType<typeof createWorld>, id = 'p') {
  const p = w.players[id];
  p.health = 1;
  p.hunger = p.thirst = 50000;
  advance(w, 1);
}
const notices = (w: ReturnType<typeof createWorld>) =>
  w.messages.filter((m) => /has begun a new life|offline absence limit/.test(m.text));

test('mute repeated offline notices, retaining every death and its consequences', () => {
  const { w, p } = setup();
  p.cash = 100000;
  w.settings.deathCashRetention = 0.5;
  const unmuted = structuredClone(w);
  act(unmuted, p.id, { type: 'settings', patch: { muteRepeatedOfflineDeaths: false } });
  for (let i = 0; i < 3; i++) {
    die(w);
    die(unmuted);
  }
  assert.equal(p.deaths, 3);
  assert.equal(p.cash, 12500);
  assert.equal(p.history!.filter((e) => e.kind === 'death').length, 3);
  assert.equal(notices(w).length, 1);
  assert.equal(notices(unmuted).length, 3);
  assert.deepEqual(w.players, unmuted.players);
  assert.deepEqual(w.ledger, unmuted.ledger);
});

test('long catch-up and old players without a marker announce only the first death', () => {
  const { w, p } = setup();
  p.deaths = 42;
  w.settings.hungerRate = w.settings.thirstRate = 100;
  advance(w, 40000);
  assert.ok(p.deaths >= 45);
  assert.equal(notices(w).length, 1);
});

test('online deaths remain announced and different absent players each get a notice', () => {
  const { w, p } = setup();
  p.online = true;
  die(w);
  die(w);
  assert.equal(notices(w).length, 2);
  p.online = false;
  die(w);
  assert.equal(notices(w).length, 2, 'no return since the last online death');
  const q = addPlayer(w, 'q', 'Another pilot');
  q.inventory = {};
  die(w, q.id);
  die(w, q.id);
  assert.equal(notices(w).length, 3);
  p.online = true;
  advance(w, 1);
  p.online = false;
  die(w);
  assert.equal(notices(w).length, 4);
});

test('persist the mute through save/load and suppress a later absence-limit notice', () => {
  const { w } = setup();
  const store = new Store(':memory:');
  try {
    die(w);
    store.saveWorld(w);
    const loaded = store.loadWorlds().find((entry) => entry.world.id === w.id)!.world;
    die(loaded);
    assert.equal(loaded.players.p.deaths, 2);
    assert.equal(notices(loaded).length, 1);
    loaded.settings.maxOfflineDays = 3 / 86400;
    advance(loaded, 2);
    assert.equal(loaded.players.p.deaths, 3);
    assert.equal(notices(loaded).length, 1);
  } finally {
    store.close();
  }
});
