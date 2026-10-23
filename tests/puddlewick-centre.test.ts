// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeBuilding } from '../src/shared/simulation.ts';
import { normalizeTowns, meetingTown } from '../src/shared/civics.ts';
import { restorePuddlewickCentre } from '../src/server/puddlewick-centre.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';
import { governmentStores } from '../src/server/government-stores.ts';
import { roadDistance, townRoads } from '../src/shared/town.ts';
import { constructionSiteReason } from '../src/shared/construction-site.ts';
import { onFarmLand } from '../src/shared/farm-land.ts';
import { Store } from '../src/server/store.ts';

function retiredParish() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.buildings = w.buildings.filter((b) => b.kind !== 'town');
  delete w.towns[0].plinth;
  w.parishRetired = ['town'];
  governmentStores(w);
  return w;
}

test('restore a safe public fountain once without changing property, borders or civic finances', () => {
  const w = retiredParish(),
    town = w.towns[0];
  w.owner = 'hank';
  w.publicParishVersion = 1;
  const far = makeBuilding('town-east', 'town', 770, 92);
  w.buildings.push(far);
  const east = {
    ...structuredClone(town),
    id: 'east',
    name: 'East',
    x: 770,
    z: 92,
    plinth: far.id,
  };
  w.towns.push(east);
  town.plinth = far.id;
  town.treasury = 123456;
  town.mayor = 'hank';
  const properties = structuredClone(w.buildings),
    remoteTown = structuredClone(east);
  const centre = [town.x, town.z],
    radius = town.radius;
  assert.equal(restorePuddlewickCentre(w), true);
  assert.deepEqual(w.buildings.slice(0, properties.length), properties);
  assert.deepEqual(east, remoteTown);
  const b = w.buildings.at(-1)!;
  assert.equal(town.plinth, b.id);
  assert.equal(b.style, undefined, 'the unstyled town model is the fountain with benches');
  assert.equal(b.owner, 'treasury');
  assert.equal(b.forSale, false);
  assert.equal(b.investment, 0);
  assert.deepEqual([town.x, town.z], centre);
  assert.equal(town.radius, radius);
  assert.equal(town.treasury, 123456);
  assert.equal(town.mayor, 'hank');
  assert.equal(w.owner, 'hank');
  assert.ok(roadDistance(townRoads(w), b.x, b.z) >= 9);
  assert.ok(!onFarmLand(w, b.x, b.z, 10));
  assert.equal(constructionSiteReason({ ...w, buildings: properties }, b), undefined);
  assert.equal(meetingTown(w, far.id)?.id, 'east');
  assert.equal(meetingTown(w, b.id)?.id, 'puddlewick');
  const store = new Store(':memory:');
  try {
    store.saveWorld(w);
    const loaded = store.loadWorlds()[0].world;
    const snapshot = JSON.stringify(loaded);
    assert.equal(restorePuddlewickCentre(loaded), false);
    assert.equal(JSON.stringify(loaded), snapshot);
    loaded.buildings = loaded.buildings.filter((v) => v.id !== b.id);
    normalizeTowns(loaded);
    assert.equal(restorePuddlewickCentre(loaded), false, 'respect later deliberate demolition');
    assert.equal(loaded.towns[0].plinth, undefined);
  } finally {
    store.close();
  }
});

test('new starter council survives parish cleanup and needs no duplicate fountain', () => {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  const original = structuredClone(w.buildings.find((b) => b.kind === 'town')!);
  completePuddlewick(w);
  assert.equal(restorePuddlewickCentre(w), true);
  assert.deepEqual(
    w.buildings.filter((b) => b.kind === 'town'),
    [original],
  );
  assert.equal(restorePuddlewickCentre(w), false);
});

test('blocked lots retry later; custom worlds and existing property are preserved', () => {
  const w = retiredParish();
  w.zones.push({ id: 'blocked', kind: 'noBuild', x: 0, z: 0, radius: 200 });
  const before = structuredClone(w.buildings);
  assert.equal(restorePuddlewickCentre(w), false);
  assert.equal(w.publicCivicVersion, undefined);
  assert.deepEqual(w.buildings, before);
  w.zones = [];
  const collision = makeBuilding('parish-civic-centre', 'home', -200, -200);
  collision.owner = 'hank';
  w.buildings.push(collision);
  assert.equal(restorePuddlewickCentre(w), true);
  assert.equal(w.towns[0].plinth, 'parish-civic-centre-new');
  assert.ok(w.buildings.includes(collision));
  for (const custom of [
    createWorld('other', 'Puddlewick', 'server'),
    createWorld('puddlewick', 'Custom', 'owner'),
  ]) {
    const before = JSON.stringify(custom);
    assert.equal(restorePuddlewickCentre(custom), false);
    assert.equal(JSON.stringify(custom), before);
  }
});

test('restoration avoids expanded farmland even when the farm building is far from its fields', () => {
  const w = retiredParish();
  const probe = structuredClone(w);
  assert.equal(restorePuddlewickCentre(probe), true);
  const first = probe.buildings.at(-1)!;
  const farm = w.buildings.find((b) => b.kind === 'farm')!;
  Object.assign(farm, { farmPlots: 16, x: first.x - 58, z: first.z - 9, rotation: 0 });
  assert.ok(onFarmLand(w, first.x, first.z));
  assert.equal(restorePuddlewickCentre(w), true);
  const placed = w.buildings.at(-1)!;
  assert.ok(!onFarmLand(w, placed.x, placed.z, 10));
});
