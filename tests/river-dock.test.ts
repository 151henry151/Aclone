// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addPlayer, act, makeBuilding, move } from '../src/shared/simulation';
import { expandPuddlewickIsland } from '../src/server/puddlewick-island';
import { riverBanks } from '../src/shared/inland-water';
import { riverDepth } from '../src/shared/inland-travel';
import { surfaceWaterLevel } from '../src/shared/ocean';
import { constructionSiteReason } from '../src/shared/construction-site';
import { boatLandings } from '../src/shared/boathouse';
import { mooringKey, FISHING_BOAT, MOTORBOAT } from '../src/shared/boats';
import { riverDockSite, riverDockAccepts, RIVER_DOCK } from '../src/shared/river-dock';
import { buildingMapIcons } from '../src/client/map-icons';
import { buildings } from '../src/shared/catalog';
import { terrainHeight } from '../src/shared/terrain';

const CANAL_BOAT = 3;
function world() {
  const w = createWorld('puddlewick', 'Puddlewick', 'server');
  w.settings.mapSize = 18500;
  w.terrainMapSize = 12500;
  w.townLayout = 2;
  expandPuddlewickIsland(w);
  w.buildings = [];
  w.settings.vehicleLicences = false;
  w.settings.requireCaptainSkill = false;
  return w;
}
const w = world();
/** A dock on the given bank of river point `i`: landing 3.5 m back from the
 * waterline with the jetty pointing at the channel. */
function dockAt(river: number, i: number, side: 'left' | 'right') {
  const r = w.northernIsland!.rivers[river],
    p = r.points[i],
    bank = riverBanks(r.points)[i][side];
  const d = Math.hypot(bank.x - p.x, bank.z - p.z) || 1;
  const nx = (bank.x - p.x) / d,
    nz = (bank.z - p.z) / d;
  const b = makeBuilding(
    `dock-${river}-${i}-${side}`,
    RIVER_DOCK,
    bank.x + nx * 3.5,
    bank.z + nz * 3.5,
  );
  b.rotation = Math.atan2(nx, nz);
  return b;
}
function usableDock() {
  const r = w.northernIsland!.rivers[0];
  for (let i = Math.floor(r.points.length * 0.55); i < r.points.length - 3; i++)
    for (const side of ['left', 'right'] as const) {
      const b = dockAt(0, i, side);
      if (!constructionSiteReason(w, b)) return b;
    }
  assert.fail('no usable river dock site on the lower river');
}

test('the river dock is a cheap log-and-gravel landing with its own map symbol', () => {
  const def = buildings[RIVER_DOCK];
  assert.equal(def.name, 'River dock');
  assert.ok(def.price <= 40000, 'a small amount of money');
  assert.ok(def.materials.logs >= 20, 'mostly logs');
  assert.ok(def.materials.gravel > 0 && def.materials.gravel < def.materials.logs);
  assert.deepEqual(Object.keys(def.materials).sort(), ['gravel', 'logs']);
  assert.equal(def.tier, 0);
  assert.ok(buildingMapIcons[RIVER_DOCK]);
});

test('docks need a dry bank with at least 1.2 m of river alongside the jetty; headwaters and the sea are refused', () => {
  const dock = usableDock();
  const site = riverDockSite(w, dock)!;
  assert.ok(site, 'site resolves');
  assert.ok(riverDepth(w, site.berth) >= 1.2, `berth depth ${riverDepth(w, site.berth)}`);
  assert.ok(
    terrainHeight(w, site.land.x, site.land.z) > surfaceWaterLevel(w, site.berth.x, site.berth.z),
  );
  const shallow = dockAt(0, 12, 'left');
  assert.match(constructionSiteReason(w, shallow) ?? '', /1\.2 m|deep/);
  assert.equal(riverDockSite(w, shallow), undefined);
  // The jetty pointing inland is refused even on a deep reach.
  const backwards = { ...dock, rotation: dock.rotation + Math.PI };
  assert.match(constructionSiteReason(w, backwards) ?? '', /1\.2 m|deep/);
  // The sea is not a river, even where it is deep enough.
  const coast = makeBuilding('coast', RIVER_DOCK, 0, 4300);
  assert.equal(riverDockSite(w, coast), undefined);
});

test('a completed dock is a boat landing that moors canal boats and motorboats, not trawlers', () => {
  const copy = structuredClone(w);
  const dock = usableDock();
  dock.owner = 'someone';
  copy.buildings.push(dock);
  const landing = boatLandings(copy).find((d) => d.id === dock.id)!;
  assert.ok(landing, 'landing listed');
  assert.equal(landing.building, undefined, 'river docks keep boats moored outside');
  assert.ok(riverDepth(copy, landing.berth) >= 1.2);
  assert.ok(riverDockAccepts(copy, CANAL_BOAT));
  assert.ok(riverDockAccepts(copy, MOTORBOAT));
  assert.equal(riverDockAccepts(copy, FISHING_BOAT), false);

  const p = addPlayer(copy, 'skipper', 'Skipper');
  Object.assign(p, {
    vehicle: CANAL_BOAT,
    fleet: [0, 5, CANAL_BOAT, FISHING_BOAT],
    ...landing.berth,
    heading: landing.heading,
    y: surfaceWaterLevel(copy, landing.berth.x, landing.berth.z),
    speed: 0,
    online: true,
    engine: true,
    fuel: 10,
  });
  act(copy, p.id, { type: 'vehicle', slot: 5, building: dock.id });
  assert.equal(p.vehicle, 5);
  assert.ok(Math.hypot(p.x - landing.land.x, p.z - landing.land.z) < 0.01, 'stands on the landing');
  const moored = copy.mooredBoats?.[mooringKey(p.id, CANAL_BOAT)];
  assert.ok(moored, 'boat moored at the river dock');
  assert.equal(moored.landing, dock.id);
  assert.ok(Math.hypot(moored.x - landing.berth.x, moored.z - landing.berth.z) < 0.01);

  act(copy, p.id, { type: 'vehicle', slot: CANAL_BOAT, building: dock.id });
  assert.equal(p.vehicle, CANAL_BOAT);
  assert.equal(copy.mooredBoats?.[mooringKey(p.id, CANAL_BOAT)], undefined);
  assert.ok(
    Math.abs(p.y - surfaceWaterLevel(copy, p.x, p.z)) < 0.01,
    `boarded boat floats at river level, not sea level (${p.y})`,
  );

  // A trawler alongside the small dock cannot use it.
  Object.assign(p, { vehicle: FISHING_BOAT, ...landing.berth, heading: landing.heading });
  assert.throws(
    () => act(copy, p.id, { type: 'vehicle', slot: 5, building: dock.id }),
    /14 m long.*3\.6 m beam/i,
  );
});

test('the jetty and berth stay clear of other construction', () => {
  const copy = structuredClone(w);
  const dock = usableDock();
  copy.buildings.push(dock);
  const site = riverDockSite(copy, dock)!;
  const mid = {
    x: (dock.x + site.berth.x) / 2,
    z: (dock.z + site.berth.z) / 2,
  };
  const home = makeBuilding('home', 'home', mid.x, mid.z);
  assert.match(constructionSiteReason(copy, home) ?? '', /clear|close|dry land/);
});

test('a river dock launches, moors and reboards the same canoe with no passenger seat', () => {
  const copy = structuredClone(w),
    dock = usableDock();
  copy.buildings.push(dock);
  const landing = boatLandings(copy).find((d) => d.id === dock.id)!;
  const p = addPlayer(copy, 'paddler', 'Paddler');
  Object.assign(p, {
    vehicle: 5,
    online: true,
    ...landing.land,
    y: terrainHeight(copy, landing.land.x, landing.land.z),
    speed: 0,
    inventory: { canoe: 1 },
  });
  act(copy, p.id, { type: 'canoe', operation: 'carry' });
  const id = p.carrying!;
  act(copy, p.id, { type: 'canoe', operation: 'launch' });
  assert.deepEqual({ x: p.x, z: p.z }, landing.berth);
  const q = addPlayer(copy, 'passenger', 'Passenger');
  Object.assign(q, {
    vehicle: 5,
    online: true,
    ...landing.land,
    y: terrainHeight(copy, landing.land.x, landing.land.z),
    speed: 0,
  });
  assert.throws(() => act(copy, q.id, { type: 'hitch', player: p.id }), /No passenger room/);
  q.online = false;
  act(copy, p.id, { type: 'canoe', operation: 'beach' });
  assert.equal(copy.smallCraft![id].landing, dock.id);
  act(copy, p.id, { type: 'canoe', operation: 'board', id });
  assert.equal(p.smallCraft, id);
});

test('river size limits preserve defaults and legacy rules while custom eligibility uses length and beam', () => {
  for (const mode of ['default', 'missing', 'custom']) {
    const copy = structuredClone(w),
      owner = addPlayer(copy, 'server', 'Owner');
    if (mode === 'missing')
      for (const key of ['riverDockMaxLength', 'riverDockMaxBeam', 'riverDockDraft'])
        delete (copy.settings as any)[key];
    assert.equal(riverDockAccepts(copy, 3), true);
    assert.equal(riverDockAccepts(copy, 33), true);
    assert.equal(riverDockAccepts(copy, 30), false);
    assert.equal(riverDockAccepts(copy, 0), false);
    if (mode === 'custom') {
      act(copy, owner.id, {
        type: 'settings',
        patch: { riverDockMaxLength: 30, riverDockMaxBeam: 8 },
      });
      assert.equal(riverDockAccepts(copy, 30), true);
      act(copy, owner.id, { type: 'settings', patch: { riverDockMaxBeam: 3.6 } });
      assert.equal(riverDockAccepts(copy, 30), false);
      act(copy, owner.id, { type: 'settings', patch: { riverDockMaxLength: 5 } });
      assert.equal(riverDockAccepts(copy, 3), false);
      assert.equal(riverDockAccepts(copy, 33), true);
    }
  }
});
test('river depth edits gate existing landings and preserve moored boats until access returns', () => {
  const copy = structuredClone(w),
    dock = usableDock();
  copy.buildings = [dock];
  const site = riverDockSite(copy, dock)!;
  const p = addPlayer(copy, 'server', 'Owner');
  Object.assign(p, {
    vehicle: 3,
    fleet: [0, 5, 3],
    ...site.berth,
    heading: site.heading,
    y: site.level,
    speed: 0,
    engine: false,
    inventory: {},
    fuel: 23,
    fuelVehicle: 3,
  });
  act(copy, p.id, { type: 'vehicle', slot: 5, building: dock.id });
  const moored = structuredClone(copy.mooredBoats);
  act(copy, p.id, { type: 'settings', patch: { riverDockDraft: 20 } });
  assert.equal(riverDockSite(copy, dock), undefined);
  assert.equal(
    boatLandings(copy).some((d) => d.id === dock.id),
    false,
  );
  assert.match(constructionSiteReason(copy, dock) ?? '', /20 m/);
  assert.throws(
    () => act(copy, p.id, { type: 'vehicle', slot: 3, building: dock.id }),
    /moored boat/,
  );
  assert.deepEqual(copy.mooredBoats, moored);
  act(copy, p.id, { type: 'settings', patch: { riverDockDraft: 1.2, riverDockMaxLength: 5 } });
  assert.ok(riverDockSite(copy, dock));
  assert.throws(() => act(copy, p.id, { type: 'vehicle', slot: 3, building: dock.id }), /5.*3\.6/);
  assert.deepEqual(copy.mooredBoats, moored);
  act(copy, p.id, { type: 'settings', patch: { riverDockMaxLength: 14 } });
  act(copy, p.id, { type: 'vehicle', slot: 3, building: dock.id });
  assert.equal(p.vehicle, 3);
  assert.equal(p.fuel, 23);
  assert.equal(copy.mooredBoats?.[mooringKey(p.id, 3)], undefined);
});

for (const slot of [CANAL_BOAT, MOTORBOAT])
  test(`vessel ${slot} can approach a generated river berth under normal movement physics`, () => {
    const copy = structuredClone(w),
      dock = usableDock();
    copy.buildings.push(dock);
    const site = riverDockSite(copy, dock)!;
    const p = addPlayer(copy, 'approaching-skipper', 'Approaching skipper');
    Object.assign(p, {
      vehicle: slot,
      fuelVehicle: slot,
      fleet: [0, 5, slot],
      online: true,
      engine: true,
      fuel: 23,
      x: site.berth.x - Math.sin(site.heading) * 8,
      z: site.berth.z - Math.cos(site.heading) * 8,
      heading: site.heading,
      y: site.level,
      speed: 0,
    });
    let closest = Infinity;
    for (let i = 0; i < 900; i++) {
      move(copy, p, { throttle: 0.25, steer: 0, boost: false }, 1 / 30);
      const distance = Math.hypot(p.x - site.berth.x, p.z - site.berth.z);
      closest = Math.min(closest, distance);
      assert.ok(
        Math.abs(p.y - surfaceWaterLevel(copy, p.x, p.z)) < 0.1,
        'float at local river elevation',
      );
      if (distance < 0.3) break;
    }
    assert.ok(closest < 0.3, `approach reaches berth, closest ${closest} m`);
    p.speed = 0;
    p.boatThrottle = 0;
    const fuel = p.fuel;
    act(copy, p.id, { type: 'vehicle', slot: 5, building: dock.id });
    assert.equal(p.vehicle, 5);
    assert.equal(copy.mooredBoats?.[mooringKey(p.id, slot)]?.landing, dock.id);
    assert.equal(p.fuel, fuel);
    act(copy, p.id, { type: 'vehicle', slot, building: dock.id });
    assert.equal(p.fuel, fuel);
    assert.ok(Math.hypot(p.x - site.berth.x, p.z - site.berth.z) < 0.01);
  });
test('authored canal freight transfers at a river berth while the default coaster is refused', async () => {
  const { advance } = await import('../src/shared/simulation');
  const copy = structuredClone(w),
    dock = usableDock();
  copy.buildings.push(dock);
  const d = boatLandings(copy).find((d) => d.id === dock.id)!;
  const p = addPlayer(copy, 'freighter', 'Freighter');
  copy.vehicleTuning = { 3: { holdCapacity: 400, cargoKind: 'box' } };
  Object.assign(p, d.berth, {
    vehicle: 35,
    fleet: [0, 5, 3, 35],
    heading: d.heading,
    engine: false,
    inventory: {},
    boatHold: { stone: 10 },
  });
  assert.throws(
    () => act(copy, p.id, { type: 'vehicle', slot: 5, building: d.id }),
    /River docks take vessels/,
  );
  p.vehicle = 3;
  act(copy, p.id, { type: 'vehicle', slot: 5, building: d.id });
  assert.deepEqual(copy.mooredBoats!['freighter:3'].cargo, { stone: 10 });
  act(copy, p.id, { type: 'boatHold', slot: 3, operation: 'unload', item: 'stone', quantity: 10 });
  advance(copy, 2);
  assert.equal(p.inventory.stone, 10);
  assert.equal(copy.mooredBoats!['freighter:3'].cargo!.stone, 0);
});
