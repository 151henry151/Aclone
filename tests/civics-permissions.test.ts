// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWorld,
  addPlayer,
  advance,
  makeBuilding,
  terrainHeight,
} from '../src/shared/simulation.ts';
import { worldResources, gatheringStatus } from '../src/shared/resources.ts';
import { townAt } from '../src/shared/civics.ts';
import { roadConnected, grownRoads } from '../src/shared/roads.ts';

test('modifying the environment inside a town follows resident and guest permissions', () => {
  const w = createWorld('env', 'Env', 'owner');
  const town = w.towns[0];
  const n = worldResources(w).find((n) => n.item === 'dirt' && townAt(w, n.x, n.z) === town)!;
  const p = addPlayer(w, 'p', 'Digger');
  Object.assign(p, { x: n.x, z: n.z, y: terrainHeight(w, n.x, n.z) });
  assert.equal(gatheringStatus(w, p, n).reason, undefined);
  town.permissions.guests.environment = false;
  assert.match(gatheringStatus(w, p, n).reason!, /Only residents/);
  town.residents.push(p.id);
  assert.equal(gatheringStatus(w, p, n).reason, undefined);
  town.permissions.residents.environment = false;
  assert.match(gatheringStatus(w, p, n).reason!, /does not allow residents/);
});

test('lanes only grow toward buildings whose owners may build roads in that town', () => {
  const w = createWorld('lanes', 'Lanes', 'owner');
  const town = w.towns[0];
  let site: { x: number; z: number } | undefined;
  for (let x = 150; !site && x < 290; x += 10)
    for (let z = -200; !site && z < 200; z += 10) {
      const b = makeBuilding('probe', 'home', x, z);
      if (
        Math.hypot(x, z) < 280 &&
        terrainHeight(w, x, z) > w.settings.seaLevel + 2 &&
        w.buildings.every((o) => Math.hypot(o.x - x, o.z - z) > 30) &&
        !roadConnected(w, b)
      )
        site = { x, z };
    }
  const b = makeBuilding('far', 'home', site!.x, site!.z);
  b.owner = 'guest';
  w.buildings.push(b);
  addPlayer(w, 'guest', 'Guest');
  town.permissions.guests.roads = false;
  advance(w, w.settings.dayLength * 2);
  assert.equal(grownRoads(w).length, 0);
  town.residents.push('guest');
  advance(w, w.settings.dayLength);
  assert.equal(grownRoads(w).length, 1);
});
