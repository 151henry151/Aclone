import { stockWeight } from './fishing-expedition';
import { poweredBoat } from './boats';
import { vehicles } from './catalog';
// SPDX-License-Identifier: GPL-3.0-or-later
import { boatLanding, landingBlocked } from './boathouse';
import { blocksBuilding } from './building-shapes';
import { creatorBlocks } from './creator';
import { terrainHeight, mapHalf } from './terrain';
import { vehiclePaint } from './appearance';
import { switchVehicle } from './tractors';
import { worldItems } from './world-catalogue';
import type { Player, World } from './types';
export const LIFEBOAT = 29;
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function rescueAction(w: World, p: Player, operation: unknown) {
  need(
    !p.atHome && !p.task && !p.game && !p.hitch && !p.crowBody && Math.abs(p.speed) < 0.5,
    'Stop outside and finish your activity before using the lifeboat',
  );
  const r = w.boatRescues?.[p.id];
  if (operation === 'launch') {
    need(
      poweredBoat(p.vehicle) && p.fuel <= 0 && !r,
      'Launch the lifeboat only from your boat when its fuel tank is empty',
    );
    need(terrainHeight(w, p.x, p.z) < w.settings.seaLevel - 0.65, 'Launch the lifeboat on water');
    const clearance = (vehicles[p.vehicle].collisionRadius ?? 2) + 1.05;
    const candidates = [-1, 1].map((side) => ({
      x: p.x + Math.cos(p.heading) * clearance * side,
      z: p.z - Math.sin(p.heading) * clearance * side,
    }));
    const spot = candidates.find(
      (s) =>
        Math.max(Math.abs(s.x), Math.abs(s.z)) < mapHalf(w) - 3 &&
        [-1, 0, 1].every((dx) =>
          [-1.5, 0, 1.5].every(
            (dz) => terrainHeight(w, s.x + dx, s.z + dz) < w.settings.seaLevel - 0.35,
          ),
        ) &&
        !w.buildings.some((b) => blocksBuilding(b, s.x, s.z, 0, 1)) &&
        !creatorBlocks(w, s.x, s.z, w.settings.seaLevel, 1),
    );
    need(spot, 'There is no clear water alongside for the lifeboat');
    w.boatRescues ??= {};
    w.boatRescues[p.id] = {
      boat: {
        x: p.x,
        z: p.z,
        heading: p.heading,
        paint: vehiclePaint(p) ?? 'blue',
        slot: p.vehicle,
      },
      cargo: { ...p.inventory },
      dinghy: { ...spot, heading: p.heading, moored: false },
    };
    if (p.trawl) p.trawl = { ...p.trawl, deployed: false };
    p.inventory = {}; // Main cargo stays on the stranded boat, never duplicated into the inflatable.
    p.boatThrottle = 0;
    switchVehicle(p, LIFEBOAT, false);
    Object.assign(p, spot, { y: w.settings.seaLevel, speed: 0, engine: false });
    return 'Lifeboat launched. Row to a dock, buy Fuel, then row back to your boat. Cargo remains aboard.';
  }
  need(r, 'You have no lifeboat rescue in progress');
  if (operation === 'board') {
    need(
      !poweredBoat(p.vehicle) && p.vehicle !== LIFEBOAT && r.dinghy.moored,
      'Your lifeboat is already afloat',
    );
    const d = boatLanding(w, p, false, r.dinghy.landing);
    need(
      d && Math.hypot(d.berth.x - r.dinghy.x, d.berth.z - r.dinghy.z) < 1,
      'Return to the dock where you moored your lifeboat',
    );
    const blocked = landingBlocked(w, d, p, true);
    need(!blocked, blocked ?? 'Berth blocked');
    const weight = Object.entries(p.inventory).reduce(
      (n, [id, q]) => n + (worldItems(w)[id]?.weight ?? 0) * q,
      0,
    );
    need(weight <= 40, 'The lifeboat carries 40 weight; leave heavier cargo ashore');
    p.boatThrottle = 0;
    switchVehicle(p, LIFEBOAT, false);
    Object.assign(p, {
      x: r.dinghy.x,
      z: r.dinghy.z,
      heading: r.dinghy.heading,
      y: w.settings.seaLevel,
      speed: 0,
      engine: false,
    });
    r.dinghy.moored = false;
    return 'Back in your lifeboat. Row to your stranded boat.';
  }
  need(operation === 'reboard', 'Unknown lifeboat operation');
  need(
    p.vehicle === LIFEBOAT && Math.hypot(p.x - r.boat.x, p.z - r.boat.z) <= 5,
    'Row within five metres of your stranded boat',
  );
  const cargo = { ...r.cargo };
  for (const [id, q] of Object.entries(p.inventory)) cargo[id] = (cargo[id] ?? 0) + q;
  const defs = worldItems(w),
    capacity = vehicles[r.boat.slot].capacity;
  const cargoWeight = () =>
    Object.entries(cargo).reduce((sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0), 0) +
    (r.boat.slot === 30 ? stockWeight(w, p.boatStores) : 0);
  const oldFuel = p.fuelVehicle === r.boat.slot ? p.fuel : (p.parkedFuel?.[r.boat.slot] ?? 0);
  let poured = 0,
    fuel = oldFuel;
  // A completely full stranded hold must not prevent rescue. Pour only the
  // carried Fuel needed to make room, alongside the actual boat, before boarding.
  while (
    cargoWeight() > capacity &&
    poured < (p.inventory.fuel ?? 0) &&
    defs.fuel?.fuel &&
    fuel < (vehicles[r.boat.slot].tank ?? 64)
  ) {
    poured++;
    cargo.fuel--;
    fuel = Math.min(vehicles[r.boat.slot].tank ?? 64, fuel + defs.fuel.fuel);
  }
  need(
    cargoWeight() <= capacity,
    'The combined cargo exceeds the boat hold; reduce your carried load first',
  );
  p.boatThrottle = 0;
  switchVehicle(p, r.boat.slot, false);
  p.inventory = cargo;
  p.fuel = fuel;
  Object.assign(p, {
    x: r.boat.x,
    z: r.boat.z,
    heading: r.boat.heading,
    y: w.settings.seaLevel,
    speed: 0,
    engine: false,
  });
  delete w.boatRescues![p.id];
  if (poured)
    return `Main boat reboarded, lifeboat stowed and ${poured} Fuel poured into the tank to make room in the hold.`;
  return 'Main boat reboarded and lifeboat stowed. Use Fuel from your inventory to fill its tank.';
}
