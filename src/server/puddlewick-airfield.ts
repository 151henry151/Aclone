// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { airfieldAreas, onAirfield, type Airfield } from '../shared/airfield';
import { isPublicPuddlewick } from '../shared/harbour-supply';
import { log, makeBuilding } from '../shared/simulation';
import { terrainHeight, mapHalf } from '../shared/terrain';
import { blocksBuilding } from '../shared/building-shapes';
import { onFarmLand } from '../shared/farm-land';
import { creatorBlocks } from '../shared/creator';
import { worldResources } from '../shared/resources';
import { flightRules } from '../shared/flight-rules';

/** 50d. Five denarii over the boathouse pump (45d), above the garage bid (43.12d)
 * and the harbour bid (34.65d), and under this hangar's own pump (53.50d). */
export const HANGAR_FUEL_BID = 5000;

/** The public hangar buys fuel, and its till receives 500s once so a delivery can be paid. */
export function prepareAirfieldFuelDesk(w: World) {
  if (!isPublicPuddlewick(w) || w.airfieldFuelDeskVersion) return false;
  const hangar = w.buildings.find((b) => b.aircraftHangar && b.id === w.airfield?.hangar);
  if (!hangar) return false;
  hangar.buy.fuel = HANGAR_FUEL_BID;
  const till = 500 * w.settings.denariiPerSheckle * 100;
  hangar.investment += till;
  log(w, 'faucet', till, 'operator', hangar.id, 'Airfield hangar fuel till');
  w.airfieldFuelDeskVersion = 1;
  w.revision++;
  return true;
}

/** Public works on a vacant west-side site only. Never remove or move private property. */
export function ensurePuddlewickAirfield(w: World) {
  const rules = flightRules(w.settings);
  const target = `${rules.runwayLength}/${rules.runwayWidth}/${rules.runwayShoulder}/${rules.runwayClearance}/${rules.runwayMaxGrade}`;
  if (
    (w.airfield && w.airfieldLandingVersion === target) ||
    w.id !== 'puddlewick' ||
    w.template !== 'economy' ||
    (w.owner !== 'server' && !w.publicParishVersion)
  )
    return false;
  const town = w.towns.find((t) => t.id === 'puddlewick');
  if (!town || w.buildings.length >= 500) return false;
  const resources = worldResources(w);
  const previous = w.airfield;
  const natural = { ...w, airfield: undefined };
  const lengths = Array.from({ length: Math.ceil((rules.runwayLength - 220) / 10) + 1 }, (_, i) =>
    Math.max(220, rules.runwayLength - i * 10),
  );
  for (const length of lengths)
    for (const z of [-85, ...Array.from({ length: 17 }, (_, i) => -105 + i * 5)])
      for (const x of previous ? [previous.x] : [-195, -200, -190, -205]) {
        const a: Airfield = {
          x,
          z,
          length,
          width: rules.runwayWidth,
          clearance: rules.runwayClearance,
          height: previous?.height ?? terrainHeight(natural, x, -85),
          hangar: 'parish-airfield-hangar',
          apronX: previous?.apronX ?? x + 27,
          apronZ: previous?.apronZ ?? -85,
        };
        let safe = !!previous || !w.buildings.some((b) => b.id === a.hangar);
        survey: for (const r of airfieldAreas(a)) {
          for (let dx = -r.hx - rules.runwayShoulder; dx <= r.hx + rules.runwayShoulder; dx += 2)
            for (
              let dz = -r.hz - rules.runwayShoulder;
              dz <= r.hz + rules.runwayShoulder;
              dz += 2
            ) {
              const px = r.x + dx,
                pz = r.z + dz,
                h = terrainHeight(natural, px, pz);
              // Already level ground in the feathered fringe needs no earthwork.
              // Keep all obstacles out of the level clearance, and protect property
              // throughout any fringe whose elevation would actually change.
              const levelClearance = Math.abs(dx) <= r.hx && Math.abs(dz) <= r.hz;
              const grading = levelClearance || Math.abs(h - a.height) > 1e-6;
              if (
                (levelClearance && Math.hypot(px - town.x, pz - town.z) >= town.radius) ||
                Math.max(Math.abs(px), Math.abs(pz)) >= mapHalf(w) ||
                h <= w.settings.seaLevel + 0.3 ||
                Math.abs(h - a.height) > rules.runwayMaxGrade ||
                (grading &&
                  (w.buildings.some(
                    (b) => b.id !== previous?.hangar && blocksBuilding(b, px, pz, 0, 4),
                  ) ||
                    onFarmLand(w, px, pz, 4) ||
                    creatorBlocks(w, px, pz, h, 4) ||
                    w.zones.some(
                      (n) => n.kind === 'noBuild' && Math.hypot(n.x - px, n.z - pz) < n.radius,
                    )))
              ) {
                safe = false;
                break survey;
              }
            }
        }
        if (!safe) continue;
        // Clear public gathering grounds from the runway, retaining IDs and depletion.
        // Find all replacement sites before mutating the world.
        const moved = { ...w.resourceRelocations };
        let relocationFailed = false;
        for (const n of resources.filter((n) => onAirfield({ airfield: a }, n.x, n.z, 12))) {
          let found = false;
          for (let radius = 20; radius <= 140 && !found; radius += 10)
            for (let angle = 0; angle < Math.PI * 2 && !found; angle += Math.PI / 12) {
              const px = Math.round(n.x + Math.cos(angle) * radius),
                pz = Math.round(n.z + Math.sin(angle) * radius);
              const h = terrainHeight(w, px, pz);
              if (
                onAirfield({ airfield: a }, px, pz, 14) ||
                Math.max(Math.abs(px), Math.abs(pz)) > mapHalf(w) - 20 ||
                h <= w.settings.seaLevel + 1 ||
                w.buildings.some((b) => blocksBuilding(b, px, pz, 0, 12)) ||
                onFarmLand(w, px, pz, 12) ||
                creatorBlocks(w, px, pz, h, 12) ||
                resources.some((o) => {
                  const p = moved[o.id] ?? o;
                  return o.id !== n.id && Math.hypot(p.x - px, p.z - pz) < 18;
                })
              )
                continue;
              moved[n.id] = { x: px, z: pz };
              found = true;
            }
          if (!found) relocationFailed = true;
        }
        if (relocationFailed) continue;
        const hangar = previous ? undefined : makeBuilding(a.hangar, 'garage', x + 40, -85);
        if (hangar)
          Object.assign(hangar, {
            name: 'Puddlewick airfield hangar',
            aircraftHangar: true,
            rotation: -Math.PI / 2,
            owner: 'treasury',
            government: true,
            forSale: false,
            stock: { fuel: 100 },
            buy: {},
            sell: { fuel: 5350 },
            investment: 0,
            employees: [],
            foundationY: a.height + 0.04,
          });
        w.airfield = a;
        w.airfieldLandingVersion = target;
        w.resourceRelocations = moved;
        if (hangar) w.buildings.push(hangar);
        prepareAirfieldFuelDesk(w);
        w.revision++;
        return true;
      }
  return false;
}
