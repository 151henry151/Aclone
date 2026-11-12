// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, makeBuilding, act, move, advance } from '../src/shared/simulation';
import type { Player } from '../src/shared/types';
import {
  trailerAction,
  trailerAccepts,
  trailerFactors,
  trailerDefs,
  moveTrailer,
  trailerBlocks,
  type Trailer,
} from '../src/shared/trailers';
import { terrainHeight } from '../src/shared/terrain';
const setup = () => {
  const w = createWorld('trailers', 'Trailer tests', 's'),
    p = addPlayer(w, 'p', 'P');
  w.buildings = [];
  w.terrain = [];
  w.landscape = undefined;
  w.settings.seaLevel = -100;
  Object.assign(p, {
    x: 0,
    z: -200,
    y: terrainHeight(w, 0, -200),
    heading: 0,
    vehicle: 0,
    inventory: {},
    cash: 2000000,
    online: true,
    speed: 0,
  });
  const b = makeBuilding('garage', 'garage', 14, -200);
  w.buildings.push(b);
  return { w, p, b };
};
const trailer = (kind: keyof typeof trailerDefs = 'box'): Trailer => ({
  id: 't',
  owner: 'p',
  kind,
  x: 0,
  z: -207,
  heading: 0,
  cargo: {},
  attached: 'p',
});
test('eight agricultural and three manufactured trailers enforce weight, volume and cargo compatibility', () => {
  const { w } = setup();
  assert.equal(Object.keys(trailerDefs).length, 11);
  for (const kind of Object.keys(trailerDefs) as (keyof typeof trailerDefs)[]) {
    const t = trailer(kind);
    assert.equal(trailerAccepts(w, t, 'not-an-item', 1), false);
  }
  const hay = trailer('hay');
  assert.ok(trailerAccepts(w, hay, 'hay', 100));
  assert.equal(trailerAccepts(w, hay, 'steel', 100), false);
  const livestock = trailer('livestock');
  assert.ok(trailerAccepts(w, livestock, 'cows', 1));
  assert.equal(trailerAccepts(w, livestock, 'cows', 9), false);
  const tank = trailer('tanker');
  tank.cargo.water = 1;
  assert.equal(trailerAccepts(w, tank, 'milk', 1), false);
  assert.ok(trailerAccepts(w, tank, 'water', 10));
  assert.ok(trailerAccepts(w, trailer('fish'), 'largeFish', 1));
  assert.equal(trailerAccepts(w, trailer('box'), 'fish', 1), false);
  assert.ok(trailerAccepts(w, trailer('dump'), 'stone', 10));
  assert.ok(trailerAccepts(w, trailer('logs'), 'wood', 10));
});
test('buy, load, park, reconnect and restart preserve one paid trailer and exact cargo', () => {
  const { w, p, b } = setup(),
    cash = p.cash;
  trailerAction(w, p, { type: 'trailer', operation: 'buy', kind: 'box', building: b.id });
  const t = Object.values(w.trailers!)[0];
  assert.equal(p.cash, cash - trailerDefs.box.price);
  p.inventory.bread = 12;
  trailerAction(w, p, {
    type: 'trailer',
    operation: 'load',
    id: t.id,
    item: 'bread',
    quantity: 10,
  });
  assert.equal(t.cargo.bread, 10);
  assert.equal(p.inventory.bread, 2);
  assert.throws(() =>
    trailerAction(w, p, {
      type: 'trailer',
      operation: 'load',
      id: t.id,
      item: 'bread',
      quantity: 3,
    }),
  );
  assert.equal(t.cargo.bread, 10);
  assert.throws(() => act(w, p.id, { type: 'vehicle', slot: 5 }), /Unhitch/);
  trailerAction(w, p, { type: 'trailer', operation: 'unhitch', id: t.id });
  trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id });
  const saved = JSON.parse(JSON.stringify(w));
  assert.equal(saved.trailers[t.id].cargo.bread, 10);
  trailerAction(saved, saved.players.p, {
    type: 'trailer',
    operation: 'unload',
    id: t.id,
    item: 'bread',
    quantity: 10,
  });
  assert.equal(saved.players.p.inventory.bread, 12);
  assert.equal(saved.trailers[t.id].cargo.bread, undefined);
});
test('trailer trading uses the same cash, shop stock, prices and capacity as hand cargo', () => {
  const { w, p, b } = setup(),
    t = trailer();
  w.trailers = { t };
  b.kind = 'store';
  b.sell = { bread: 1000 };
  b.buy = { bread: 800 };
  b.stock = { bread: 100 };
  b.investment = 100000;
  b.capacity = 1000;
  act(w, p.id, {
    type: 'trade',
    building: b.id,
    direction: 'buy',
    item: 'bread',
    quantity: 10,
    storage: 'trailer',
  });
  assert.equal(t.cargo.bread, 10);
  assert.equal(p.inventory.bread, undefined);
  assert.equal(b.stock.bread, 90);
  act(w, p.id, {
    type: 'trade',
    building: b.id,
    direction: 'sell',
    item: 'bread',
    quantity: 10,
    storage: 'trailer',
  });
  assert.equal(t.cargo.bread ?? 0, 0);
  assert.equal(b.stock.bread, 100);
  const before = JSON.stringify(w);
  assert.throws(() =>
    act(w, p.id, {
      type: 'trade',
      building: b.id,
      direction: 'sell',
      item: 'bread',
      quantity: 1,
      storage: 'trailer',
    }),
  );
  assert.equal(JSON.stringify(w), before);
});
test('loaded trailers add drag; articulated movement and prediction do not duplicate or mutate shared cargo', () => {
  const { w, p } = setup(),
    t = trailer('hay');
  w.buildings = [];
  w.trailers = { t };
  t.z = p.z - (trailerDefs.hay.length / 2 + 4.1);
  const empty = trailerFactors(w, p);
  t.cargo.hay = 100;
  assert.ok(trailerFactors(w, p).speed < empty.speed);
  assert.ok(trailerFactors(w, p).fuel > empty.fuel);
  const before = { x: p.x, z: p.z, heading: p.heading };
  p.z += 0.2;
  moveTrailer(w, p, before, 0.1);
  assert.ok(t.z > before.z - 8);
  const saved = JSON.stringify(w.trailers),
    predicted = structuredClone(p),
    old = { x: p.x, z: p.z, heading: p.heading };
  predicted.z += 0.2;
  moveTrailer(w, predicted, old, 0.1, true);
  assert.equal(JSON.stringify(w.trailers), saved);
  assert.ok(trailerBlocks(w, { x: t.x - 5, z: t.z }, { x: t.x + 5, z: t.z }, 0.25));
});

test('animal transfers conserve the herd and refuse a farm without grazing space', async () => {
  const { ensurePastures } = await import('../src/shared/pastures');
  const { w, p, b } = setup(),
    t = trailer('livestock');
  w.trailers = { t };
  b.kind = 'dairy';
  b.owner = p.id;
  b.stock = { cows: 4 };
  ensurePastures(w);
  trailerAction(w, p, {
    type: 'trailer',
    operation: 'load',
    id: t.id,
    item: 'cows',
    quantity: 2,
    building: b.id,
  });
  assert.equal(b.stock.cows, 2);
  assert.equal(t.cargo.cows, 2);
  b.stock.cows = 4;
  assert.throws(
    () =>
      trailerAction(w, p, {
        type: 'trailer',
        operation: 'unload',
        id: t.id,
        item: 'cows',
        quantity: 2,
        building: b.id,
      }),
    /grazing|pasture|space/i,
  );
  assert.equal(t.cargo.cows, 2);
  assert.equal(b.stock.cows, 4);
  b.stock.cows = 2;
  trailerAction(w, p, {
    type: 'trailer',
    operation: 'unload',
    id: t.id,
    item: 'cows',
    quantity: 2,
    building: b.id,
  });
  assert.equal(b.stock.cows, 4);
  assert.equal(t.cargo.cows, undefined);
});
test('death parks the trailer and applies the configured inventory loss rule', () => {
  for (const lose of [true, false]) {
    const { w, p } = setup(),
      t = trailer('box');
    t.cargo.bread = 10;
    w.trailers = { t };
    w.settings.loseInventoryOnDeath = lose;
    p.age = w.settings.maxAge + 1;
    advance(w, 0.1);
    assert.equal(t.attached, undefined);
    assert.equal(t.owner, p.id);
    assert.equal(t.cargo.bread, lose ? undefined : 10);
  }
});
test('trailer handling says which condition failed instead of one stop-outside line', () => {
  const { w, p } = setup(),
    t = trailer('box');
  delete t.attached;
  w.trailers = { t };
  p.speed = 1;
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /Come to a full stop before handling a trailer/,
  );
  p.speed = 0;
  p.atHome = true;
  assert.throws(
    () =>
      trailerAction(w, p, {
        type: 'trailer',
        operation: 'load',
        id: t.id,
        item: 'bread',
        quantity: 1,
      }),
    /Leave the building before handling a trailer/,
  );
  p.atHome = false;
  p.inside = 'cottage';
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /Leave the building before handling a trailer/,
  );
  delete p.inside;
  p.hitch = 'driver';
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /Leave the passenger seat before handling a trailer/,
  );
  delete p.hitch;
  p.task = { kind: 'labour' } as Player['task'];
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: t.id }),
    /Finish your current activity before handling a trailer/,
  );
});
test('a tractor beside a row of trailers is told the drawbar is blocked', () => {
  const { w, p } = setup(),
    box = trailer('box'),
    hay = trailer('hay');
  delete box.attached;
  delete hay.attached;
  hay.id = 'hay';
  hay.z = -200.4;
  w.trailers = { t: box, hay };
  p.x = 5;
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: box.id }),
    /drawbar is at the front of this trailer[\s\S]*Harvest hay wagon[\s\S]*Move that trailer clear/,
  );
  delete w.trailers.hay;
  p.x = 0;
  p.z = -197;
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: box.id }),
    /rear hitch meets the drawbar at the front[\s\S]*m from the drawbar/,
  );
  const nose = box.z + trailerDefs.box.length / 2 + 1.4;
  p.x = 2.7;
  p.z = nose;
  p.heading = Math.PI / 2;
  assert.throws(
    () => trailerAction(w, p, { type: 'trailer', operation: 'hitch', id: box.id }),
    /Point the tractor the same way as the trailer/,
  );
});
test('the trailer panel shows the hitch reason before the player clicks', async () => {
  const { trailerPanel } = await import('../src/client/trailer-panel');
  const { w, p } = setup(),
    box = trailer('box'),
    hay = trailer('hay');
  delete box.attached;
  delete hay.attached;
  hay.id = 'hay';
  hay.z = -200.4;
  w.trailers = { t: box, hay };
  p.x = 5;
  const blocked = trailerPanel(w, p);
  assert.match(blocked, /disabled>Hitch trailer/);
  assert.match(blocked, /Harvest hay wagon/);
  delete w.trailers.hay;
  p.x = 0;
  p.z = -200;
  const ready = trailerPanel(w, p);
  assert.match(ready, /<button>Hitch trailer<\/button>/);
  assert.doesNotMatch(ready, /disabled>Hitch trailer/);
});
test('a trailer cannot sweep through a building when the tractor has cleared it', () => {
  const { w, p } = setup(),
    t = trailer('hay');
  t.z = p.z - 7.4;
  w.trailers = { t };
  w.buildings = [makeBuilding('block', 'home', 0, t.z)];
  const before = { x: p.x, z: p.z, heading: p.heading },
    saved = { ...t };
  p.z += 0.5;
  p.speed = 2;
  moveTrailer(w, p, before, 0.1);
  assert.equal(p.z, before.z);
  assert.equal(p.speed, 0);
  assert.deepEqual(t, saved);
});
