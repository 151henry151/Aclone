import { cancelTow } from './towing';
import { vehicleDef } from './vehicle-config';
import { waterLevel } from './ocean';
import { stockWeight } from './fishing-expedition';
import { MOTORBOAT, mooringKey, boatSlot, poweredBoat } from './boats';
import { vehicles } from './catalog';
// SPDX-License-Identifier: GPL-3.0-or-later
import { aboardBoat, boatLanding, boatLandings, landingBlocked } from './boathouse';
import { blocksBuilding } from './building-shapes';
import { creatorBlocks } from './creator';
import { terrainHeight, mapHalf } from './terrain';
import { vehiclePaint } from './appearance';
import { switchVehicle } from './tractors';
import { worldItems } from './world-catalogue';
import { say } from './simulation';
import type { Player, World } from './types';
export const LIFEBOAT = 29;
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
/** Runs on simulation time, including offline catch-up. Frozen calendars do not age stores. */
export function expireAbandonedCargo(w: World, at = w.time) {
  for (const [id, r] of Object.entries(w.boatRescues ?? {})) {
    const timer = r.spoilage;
    if (!timer || timer.spoiled || timer.never) continue;
    const elapsed = Math.max(0, at - timer.checkedAt);
    if (w.settings.dayLength > 0)
      timer.daysLeft = Math.max(0, timer.daysLeft - elapsed / w.settings.dayLength);
    timer.checkedAt = Math.max(timer.checkedAt, at);
    if (timer.daysLeft > 1e-9) continue;
    timer.daysLeft = 0;
    timer.spoiled = true;
    r.cargo = {};
    delete r.provisions;
    delete r.net;
    say(
      w,
      'Boat recovery',
      'Your abandoned cargo, net catch and provisions have spoiled after the world’s recovery period. The boat and any fuel remaining in its tank are still recoverable.',
      'system',
      id,
    );
  }
}

/** Capture the vessel before death resets the character. Never move the boat to the respawn. */
export function abandonBoatOnDeath(w: World, p: Player, at: number) {
  const aboard = aboardBoat(w, p);
  let r = w.boatRescues?.[p.id];
  const loses = (slot: number) => {
    const policy = vehicleDef(w, slot).deathPolicy ?? 'world';
    return policy === 'lose' || (policy === 'world' && w.settings.loseBoatsOnDeath);
  };
  const lost = vehicles
    .map((_, slot) => slot)
    .filter(
      (slot) =>
        (poweredBoat(slot, w) ? loses(slot) : vehicleDef(w, slot).deathPolicy === 'lose') &&
        ((p.fleet ?? []).includes(slot) ||
          r?.boat.slot === slot ||
          (!p.hitch && p.vehicle === slot)),
    );
  const activeLost = r ? lost.includes(r.boat.slot) : !p.hitch && lost.includes(p.vehicle);
  if (lost.length) {
    p.fleet = (p.fleet ?? [0, 5]).filter((slot) => !lost.includes(slot));
    for (const slot of lost) {
      if (p.fuelVehicle === slot || (p.fuelVehicle === undefined && p.vehicle === slot)) p.fuel = 0;
      if (p.parkedFuel) delete p.parkedFuel[slot];
      if (p.vehiclePaints) delete p.vehiclePaints[slot];
      if (p.fleetState) delete p.fleetState[slot];
    }
    for (const [key, boat] of Object.entries(w.mooredBoats ?? {}))
      if (boat.owner === p.id && lost.includes(boat.slot)) delete w.mooredBoats![key];
    if (activeLost) {
      if (w.boatRescues) delete w.boatRescues[p.id];
      r = undefined;
      p.inventory = {};
      delete p.boatStores;
      delete p.boatLighting;
    }
    say(
      w,
      'Boat loss',
      'Owned vessels subject to the death-loss rule have been removed with their cargo, provisions and fuel.',
      'system',
      p.id,
    );
  }
  if (activeLost) return aboard ? { dock: boatLandings(w)[0] } : undefined;
  if (!aboard && !r) return undefined;
  const dock = boatLandings(w).sort(
    (a, b) =>
      Math.hypot(a.berth.x - p.x, a.berth.z - p.z) - Math.hypot(b.berth.x - p.x, b.berth.z - p.z),
  )[0];
  if ((!p.hitch && poweredBoat(p.vehicle, w)) || r) {
    if (!r) {
      w.boatRescues ??= {};
      r = w.boatRescues[p.id] = {
        boat: {
          x: p.x,
          z: p.z,
          heading: p.heading,
          paint: vehiclePaint(p) ?? 'blue',
          slot: p.vehicle,
        },
        cargo: { ...p.inventory },
        dinghy: { x: p.x, z: p.z, heading: p.heading, moored: true },
      };
      // This cargo belongs to the vessel even in worlds that retain personal inventory on death.
      p.inventory = {};
    }
    if (!r.spoilage) {
      r.provisions = { ...p.boatStores };
      r.net = p.trawl ? { ...structuredClone(p.trawl), deployed: false } : undefined;
      const days = vehicleDef(w, r.boat.slot).spoilageDays ?? w.settings.boatCargoSpoilageDays ?? 5;
      r.spoilage = { daysLeft: days, checkedAt: at, ...(days === 0 ? { never: true } : {}) };
      if ((vehicleDef(w, r.boat.slot).retainFuel ?? w.settings.retainBoatFuelOnDeath) === false) {
        if (
          p.fuelVehicle === r.boat.slot ||
          (p.fuelVehicle === undefined && p.vehicle === r.boat.slot)
        )
          p.fuel = 0;
        else if (p.parkedFuel) p.parkedFuel[r.boat.slot] = 0;
      }
    }
    delete p.boatStores;
    // Recover the tender ashore after a fatal rowing trip, without moving the main vessel
    // or restarting its existing spoilage deadline.
    r.dinghy = dock
      ? { ...dock.berth, heading: dock.heading, moored: true, landing: dock.id }
      : { ...r.dinghy, moored: true, landing: undefined };
    say(
      w,
      'Boat recovery',
      `Your boat remains offshore at ${Math.round(r.boat.x)}, ${Math.round(r.boat.z)}. Board your recovery lifeboat at a dock and row back. ${r.spoilage.spoiled ? 'Its cargo has spoiled.' : r.spoilage.never ? 'Cargo spoilage is disabled here.' : `Cargo and provisions spoil in ${r.spoilage.daysLeft.toFixed(1)} game days.`}`,
      'system',
      p.id,
    );
  }
  return { dock };
}

export function rescueAction(w: World, p: Player, operation: unknown) {
  need(
    !p.atHome &&
      !p.task &&
      !p.game &&
      (!p.hitch || operation === 'reboard') &&
      !p.crowBody &&
      Math.abs(p.speed) < 0.5,
    'Stop outside and finish your activity before using the lifeboat',
  );
  expireAbandonedCargo(w);
  const r = w.boatRescues?.[p.id];
  if (operation === 'launch') {
    need(
      poweredBoat(p.vehicle, w) && p.fuel <= 0 && !r,
      'Launch the lifeboat only from your boat when its fuel tank is empty',
    );
    need(terrainHeight(w, p.x, p.z) < waterLevel(w) - 0.65, 'Launch the lifeboat on water');
    const clearance = (vehicleDef(w, p.vehicle).collisionRadius ?? 2) + 1.05;
    const candidates = [-1, 1].map((side) => ({
      x: p.x + Math.cos(p.heading) * clearance * side,
      z: p.z - Math.sin(p.heading) * clearance * side,
    }));
    const spot = candidates.find(
      (s) =>
        Math.max(Math.abs(s.x), Math.abs(s.z)) < mapHalf(w) - 3 &&
        [-1, 0, 1].every((dx) =>
          [-1.5, 0, 1.5].every((dz) => terrainHeight(w, s.x + dx, s.z + dz) < waterLevel(w) - 0.35),
        ) &&
        !w.buildings.some((b) => blocksBuilding(b, s.x, s.z, 0, 1)) &&
        !creatorBlocks(w, s.x, s.z, waterLevel(w), 1),
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
    switchVehicle(p, LIFEBOAT, false, w);
    Object.assign(p, spot, { y: waterLevel(w), speed: 0, engine: false });
    return 'Lifeboat launched. Row to a dock, buy Fuel, then row back to your boat. Cargo remains aboard.';
  }
  need(r, 'You have no lifeboat rescue in progress');
  if (operation === 'board') {
    need(
      !poweredBoat(p.vehicle, w) && p.vehicle !== LIFEBOAT && r.dinghy.moored,
      'Your lifeboat is already afloat',
    );
    const savedDockExists = boatLandings(w).some((d) => d.id === r.dinghy.landing);
    const d = boatLanding(w, p, false, savedDockExists ? r.dinghy.landing : undefined);
    need(
      d && (!savedDockExists || Math.hypot(d.berth.x - r.dinghy.x, d.berth.z - r.dinghy.z) < 1),
      'Return to the dock where you moored your lifeboat',
    );
    const blocked = landingBlocked(w, d, p, true);
    need(!blocked, blocked ?? 'Berth blocked');
    const weight = Object.entries(p.inventory).reduce(
      (n, [id, q]) => n + (worldItems(w)[id]?.weight ?? 0) * q,
      0,
    );
    const capacity = vehicleDef(w, LIFEBOAT).capacity;
    need(weight <= capacity, `The lifeboat carries ${capacity} weight; leave heavier cargo ashore`);
    r.dinghy = { ...d.berth, heading: d.heading, moored: true, landing: d.id };
    p.boatThrottle = 0;
    switchVehicle(p, LIFEBOAT, false, w);
    Object.assign(p, {
      x: r.dinghy.x,
      z: r.dinghy.z,
      heading: r.dinghy.heading,
      y: waterLevel(w),
      speed: 0,
      engine: false,
    });
    r.dinghy.moored = false;
    return 'Back in your lifeboat. Row to your stranded boat.';
  }
  need(operation === 'reboard', 'Unknown lifeboat operation');
  const reason = reboardReason(w, p);
  need(!reason, reason ?? 'Cannot reboard here');
  const cargo = { ...r.cargo };
  for (const [id, q] of Object.entries(p.inventory)) cargo[id] = (cargo[id] ?? 0) + q;
  const defs = worldItems(w),
    capacity = vehicleDef(w, r.boat.slot).capacity;
  const cargoWeight = () =>
    Object.entries(cargo).reduce((sum, [id, n]) => sum + n * (defs[id]?.weight ?? 0), 0) +
    (r.boat.slot === 30 ? stockWeight(w, r.spoilage ? r.provisions : p.boatStores) : 0);
  const oldFuel = p.fuelVehicle === r.boat.slot ? p.fuel : (p.parkedFuel?.[r.boat.slot] ?? 0);
  let poured = 0,
    fuel = oldFuel;
  // A completely full stranded hold must not prevent rescue. Pour only the
  // carried Fuel needed to make room, alongside the actual boat, before boarding.
  while (
    cargoWeight() > capacity &&
    poured < (p.inventory.fuel ?? 0) &&
    defs.fuel?.fuel &&
    fuel < (vehicleDef(w, r.boat.slot).tank ?? 64)
  ) {
    poured++;
    cargo.fuel--;
    fuel = Math.min(vehicleDef(w, r.boat.slot).tank ?? 64, fuel + defs.fuel.fuel);
  }
  need(
    cargoWeight() <= capacity,
    'The combined cargo exceeds the boat hold; reduce your carried load first',
  );
  if (p.vehicle === MOTORBOAT && !p.hitch) {
    w.mooredBoats ??= {};
    w.mooredBoats[mooringKey(p.id, MOTORBOAT)] = {
      owner: p.id,
      slot: MOTORBOAT,
      x: p.x,
      z: p.z,
      heading: p.heading,
      paint: vehiclePaint(p) ?? 'blue',
      landing: '',
    };
  }
  const usedMotorboat = p.vehicle === MOTORBOAT && !p.hitch;
  cancelTow(w, p.id);
  delete p.hitch;
  p.boatThrottle = 0;
  switchVehicle(p, r.boat.slot, false, w);
  p.inventory = cargo;
  if (r.spoilage) {
    p.boatStores = r.provisions ? { ...r.provisions } : {};
    p.trawl = r.net ? structuredClone(r.net) : undefined;
  }
  p.fuel = fuel;
  Object.assign(p, {
    x: r.boat.x,
    z: r.boat.z,
    heading: r.boat.heading,
    y: waterLevel(w),
    speed: 0,
    engine: false,
  });
  delete w.boatRescues![p.id];
  if (usedMotorboat)
    return 'Main boat reboarded. Your motorboat remains alongside; move ahead and attach it as a tender to tow home. Use carried Fuel to fill the main tank.';
  if (poured)
    return `Main boat reboarded, lifeboat stowed and ${poured} Fuel poured into the tank to make room in the hold.`;
  return 'Main boat reboarded and lifeboat stowed. Use Fuel from your inventory to fill its tank.';
}

/** Read-only preflight used by both presentation and authoritative boarding. */
export function reboardReason(w: World, p: Player): string | undefined {
  const r = w.boatRescues?.[p.id];
  if (!r) return 'You have no stranded boat';
  if (p.atHome || p.task || p.game || p.crowBody || Math.abs(p.speed) >= 0.5)
    return 'Stop outside and finish your activity before boarding';
  if (r.landing && !boatSlot(p.vehicle, w) && boatLanding(w, p, false, r.landing)) return undefined;
  try {
    const carrier = p.hitch ? w.players[p.hitch] : undefined;
    if (p.hitch)
      need(
        carrier &&
          carrier.online &&
          !carrier.hitch &&
          !carrier.atHome &&
          boatSlot(carrier.vehicle, w) &&
          Math.abs(carrier.speed) < 0.5,
        'Ask your boat driver to stop alongside your stranded vessel',
      );
    const from = carrier ?? p;
    const reach =
      carrier || p.vehicle === MOTORBOAT
        ? (vehicleDef(w, carrier?.vehicle ?? p.vehicle).collisionRadius ?? 2) +
          (vehicleDef(w, r.boat.slot).collisionRadius ?? 2) +
          1.5
        : 5;
    need(
      (!!carrier || p.vehicle === LIFEBOAT || p.vehicle === MOTORBOAT) &&
        Math.hypot(from.x - r.boat.x, from.z - r.boat.z) <= reach,
      carrier
        ? 'Ask your boat driver to pull alongside your stranded vessel'
        : 'Row within five metres of your stranded boat',
    );
    need(
      Array.from({ length: 9 }, (_, i) => i / 8).every(
        (t) =>
          terrainHeight(w, from.x + (r.boat.x - from.x) * t, from.z + (r.boat.z - from.z) * t) <
          waterLevel(w) + 0.15,
      ),
      'Move alongside over clear water before transferring',
    );
  } catch (error) {
    return (error as Error).message;
  }
  return undefined;
}
