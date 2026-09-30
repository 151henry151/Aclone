// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/server/store.ts';
import { createWorld, addPlayer, act, advance } from '../src/shared/simulation.ts';
test('crop work, paint, styles and combat rounds survive durable world reload', () => {
  const store = new Store(':memory:');
  try {
    const w = createWorld('persist', 'Expansion', 'o', 'combat'),
      p = addPlayer(w, 'o', 'Farmer');
    const farm = w.buildings.find((b) => b.kind === 'farm')!;
    farm.owner = p.id;
    farm.investment = 10000;
    p.skills = ['farmer'];
    p.x = farm.x;
    p.z = farm.z;
    act(w, p.id, { type: 'farm', building: farm.id, operation: 'plant', plot: 0, crop: 'wheat' });
    advance(w, farm.plots![0].ready - w.time);
    act(w, p.id, { type: 'farm', building: farm.id, operation: 'harvest', plot: 0 });
    p.tractorPaint = 'blue';
    w.buildings.find((b) => b.kind === 'home')!.style = 'red-timber';
    store.saveWorld(w);
    const restored = store.loadWorlds()[0].world;
    advance(restored, 15);
    assert.ok(restored.buildings.find((b) => b.id === farm.id)!.stock.wheat > 0);
    assert.equal(restored.players.o.tractorPaint, 'blue');
    const stock = restored.buildings.find((b) => b.id === farm.id)!.stock.wheat;
    advance(restored, 15);
    assert.equal(restored.buildings.find((b) => b.id === farm.id)!.stock.wheat, stock);
    act(restored, p.id, { type: 'joinCombat', mode: 'ctf' });
    store.saveWorld(restored);
    assert.equal(store.loadWorlds()[0].world.combat?.mode, 'ctf');
  } finally {
    store.close();
  }
});
test('old worlds gain default combat rules without losing owner settings', () => {
  const s = new Store(':memory:');
  try {
    const w = createWorld('old', 'Old', 'o');
    delete w.settings.weaponMode;
    delete w.settings.killReward;
    w.settings.dayLength = 900;
    s.saveWorld(w);
    const loaded = s.loadWorlds()[0].world;
    assert.equal(loaded.settings.weaponMode, 'energy');
    assert.equal(loaded.settings.killReward, 0);
    assert.equal(loaded.settings.dayLength, 900);
  } finally {
    s.close();
  }
});
