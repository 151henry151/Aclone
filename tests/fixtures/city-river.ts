// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { createWorld } from '../../src/shared/simulation';
import { expandPuddlewickIsland } from '../../src/server/puddlewick-island';
import { creatorSchema } from '../../src/shared/creator';
import { riverBanks } from '../../src/shared/inland-water';
import { roadSite, roadRoute } from '../../src/shared/road-routing';
import { finishRoadWork } from '../../src/shared/road-work';
import { growPavedTrunkSteps } from '../../src/shared/city-trunks';
import { inlandBlocksGround } from '../../src/shared/inland-travel';

export function riverCities() {
  const w = createWorld('puddlewick', 'River cities', 'owner');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.creator = creatorSchema.parse({ roads: false, scenery: false });
  delete w.airfield;
  delete w.spaceportSite;
  const river = w.northernIsland!.rivers[0],
    p = river.points[220],
    banks = riverBanks(river.points)[220];
  const dx = (banks.right.x - banks.left.x) / p.width,
    dz = (banks.right.z - banks.left.z) / p.width;
  const a = { x: p.x - dx * 1200, z: p.z - dz * 1200 },
    b = { x: p.x + dx * 1200, z: p.z + dz * 1200 };
  const centre = { x: a.x - dx * 60, z: a.z - dz * 60 };
  const template = structuredClone(w.towns[0]);
  w.towns = [
    { ...structuredClone(template), ...centre, id: 'west-city', radius: 60 },
    { ...structuredClone(template), ...b, id: 'east-city', radius: 60 },
  ];
  w.roads = [
    { a: centre, b: a, width: 5 },
    { a: b, b: { x: b.x + dx * 10, z: b.z + dz * 10 }, width: 5 },
  ];
  w.pavedRoads = w.roads.map((r, i) => ({ ...r, town: w.towns[i].id, kind: 'urban' }));
  w.cityDevelopment = Object.fromEntries(
    w.towns.map((t) => [
      t.id,
      {
        qualified: true,
        counts: { buildings: 100, businesses: 50, residents: 50 },
        eligibleDays: 30,
        shrinkingDays: 0,
        policy: '',
      },
    ]),
  );
  assert.ok(roadSite(w).clear(a) && roadSite(w).clear(b));
  assert.ok(inlandBlocksGround(w, a, b, 2.5), 'direct crossing is deep');
  return { w, a, b };
}

export function preparedRiverApproach() {
  const { w, a, b } = riverCities();
  const dirt = roadRoute(w, a, b)!;
  w.roads!.push(...dirt.slice(1).map((b, i) => ({ a: dirt[i], b, width: 5 })));
  finishRoadWork(growPavedTrunkSteps(w, w.towns[0], [w.pavedRoads![0]], 1000));
  const project = w.pavingProjects![w.towns[0].id];
  assert.ok(project?.waitingForBridge);
  finishRoadWork(growPavedTrunkSteps(w, w.towns[0], w.pavedRoads!, 10000));
  assert.equal(project.path.length, 1);
  return w;
}
