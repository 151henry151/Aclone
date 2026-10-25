import { poweredBoat, FISHING_BOAT } from '../shared/boats';
import { aboardBoat, boatLanding, nearBoathouse } from '../shared/boathouse';
import { LIFEBOAT } from '../shared/boat-rescue';
import { aircraftCount, hasAircraftHangar } from '../shared/airfield';
// SPDX-License-Identifier: GPL-3.0-or-later
import { vehiclePaint, paintableVehicle } from '../shared/appearance';
import { fuelCapacity, returnTractor } from '../shared/tractors';
import type { Building, Player, World } from '../shared/types';
import { jobVacancy, hiringLimit } from '../shared/staffing';
import { propertyQuote } from '../shared/property';
import { winterDeadline } from '../shared/farming';
import { recipes, vehicles } from '../shared/catalog';
import { stockWeight } from '../shared/fishing-expedition';
import { requiredLicence } from '../shared/vehicle-services';
import { worldItems } from '../shared/world-catalogue';

/** Context only: affordability, distance and missing supplies stay disabled with explanations.
 * Server validation remains authoritative. undefined leaves other controls alone. */
export function actionVisible(
  w: World,
  p: Player,
  action: string,
  id?: string,
  b?: Building,
  plotIndex?: number,
  vehicleSlot?: number,
): boolean | undefined {
  const free =
    !p.atHome &&
    !p.task &&
    !p.hitch &&
    !p.crowBody &&
    p.health > 0 &&
    !(p.flight && !p.flight.grounded);
  switch (action) {
    case 'boatIdle':
      return free && p.vehicle === FISHING_BOAT;
    case 'trawl':
      return (
        free &&
        !p.game &&
        p.vehicle === FISHING_BOAT &&
        (id === 'haul' ? !!p.trawl : id === 'stow' ? !!p.trawl?.deployed : !p.trawl?.deployed)
      );
    case 'lifeboat':
      return (
        free &&
        !p.game &&
        (id === 'launch'
          ? poweredBoat(p.vehicle) && p.fuel <= 0 && !w.boatRescues?.[p.id]
          : id === 'reboard'
            ? p.vehicle === LIFEBOAT && !!w.boatRescues?.[p.id]
            : !!w.boatRescues?.[p.id]?.dinghy.moored)
      );
    case 'editor':
    case 'caretaker':
      return p.authority >= 20;
    case 'walk':
      return free && p.vehicle !== 5 && (!aboardBoat(w, p) || !!boatLanding(w, p, true));
    case 'tractor':
      return (
        free && p.vehicle !== returnTractor(p) && (!aboardBoat(w, p) || !!boatLanding(w, p, true))
      );
    case 'vehicle':
      return (
        free &&
        (!aboardBoat(w, p) ||
          (!!boatLanding(w, p, true) && [0, 5, 24, 25, 26, 27, 28].includes(Number(id)))) &&
        p.vehicle !== Number(id) &&
        (p.game !== 'combat' || [0, 5].includes(Number(id)))
      );
    case 'crow':
      return !!p.crowBody || (free && !aboardBoat(w, p) && !p.game && (p.inventory.rc ?? 0) > 0);
    case 'crowClass':
      return (
        free &&
        !aboardBoat(w, p) &&
        !p.game &&
        (p.inventory.rc ?? 0) > 0 &&
        w.settings.crowAbilities &&
        w.settings.fighting
      );
    case 'crowMark':
      return !!p.crowBody && w.settings.crowAbilities && w.settings.fighting;
    case 'crowRecall':
      return !!p.crowBody && !!p.crowMark && w.settings.crowAbilities && w.settings.fighting;
    case 'engine':
    case 'lights':
    case 'horn':
      return !p.atHome && !p.hitch && p.health > 0 && p.vehicle !== 5;
    case 'outside':
      return !!p.atHome;
    case 'detach':
      return !!p.hitch && (!aboardBoat(w, p) || !!boatLanding(w, w.players[p.hitch], true));
    case 'hitch':
      return (
        free &&
        p.game !== 'combat' &&
        !!w.players[id ?? '']?.online &&
        w.players[id ?? '']?.vehicle !== 5
      );
    case 'use': {
      const item = worldItems(w)[id ?? ''];
      return (
        !p.crowBody &&
        !!item &&
        !!(item.food || item.drink || item.health || item.maxHealth || item.fuel) &&
        (!item.fuel ||
          (p.vehicle !== LIFEBOAT &&
            !(w.boatRescues?.[p.id] && poweredBoat(p.fuelVehicle ?? -1)) &&
            p.fuel < fuelCapacity(p)))
      );
    }
    case 'discard':
    case 'readBook':
      return !p.crowBody;
    case 'joinGame':
      return (
        free &&
        p.game !== 'combat' &&
        p.game !== id &&
        (!aboardBoat(w, p) || (id === 'fishing' && poweredBoat(p.vehicle))) &&
        (id !== 'fishing' || (w.settings.fishingMode !== 0 && !p.trawl?.deployed))
      );
    case 'joinCombat':
      return (
        free &&
        !aboardBoat(w, p) &&
        w.settings.fighting &&
        p.game !== 'combat' &&
        (!w.creator?.arena.mode || w.creator.arena.mode === 'open' || w.creator.arena.mode === id)
      );
    case 'leaveGame':
      return !!p.game;
    case 'reel':
      return p.game === 'fishing';
    case 'kricket':
      return (
        p.game === 'kricket' &&
        (w.kricket.bowler === p.id || (w.kricket.batter === p.id && w.kricket.due > 0))
      );
    case 'refit':
      return free && w.settings.fighting && w.settings.weaponMode === 'ammo';
    case 'home':
      return (
        free &&
        p.game !== 'combat' &&
        !aboardBoat(w, p) &&
        !!b &&
        ((b.kind === 'home' && b.owner === p.id) || (b.lodging?.guests[p.id]?.until ?? 0) > w.time)
      );
    case 'learn':
      return !p.crowBody && !p.skills.includes(id ?? '');
    case 'job':
      return free && w.settings.jobsEnabled !== false && !!b && b.owner !== p.id && !p.job;
    case 'task':
      return (
        free && !!b && b.owner !== p.id && (id !== 'labour' || w.settings.jobsEnabled !== false)
      );
    case 'farm': {
      if (!b || !free) return false;
      if (id === 'expand') return b.owner === p.id;
      if (b.owner !== p.id && !(w.settings.jobsEnabled !== false && b.employees.includes(p.id)))
        return false;
      const plot = b.plots?.[plotIndex ?? -1];
      if (plot?.harvest || (plot?.crop && w.time >= winterDeadline(plot.planted))) return false;
      switch (id) {
        case 'plant':
          return !plot?.crop;
        case 'harvest':
          return !!plot?.crop && w.time >= plot.ready;
        case 'water':
          return !!plot?.crop && w.time < plot.ready && plot.water < 3;
        case 'fertilize':
          return !!plot?.crop && w.time < plot.ready && !plot.fertilized;
        case 'drain':
          return !!plot && !plot.crop && !plot.drainage;
        case 'improve':
          return !!plot && !plot.crop && !plot.improved;
      }
      return false;
    }
    case 'serviceVehicle':
      return free && ![5, 6, 7].includes(p.vehicle);
    case 'buyMap':
      return !p.crowBody && !(p.inventory.parishMap > 0);
    case 'paint': {
      const slot = vehicleSlot ?? (paintableVehicle(p.vehicle) ? p.vehicle : returnTractor(p));
      return (
        !p.crowBody &&
        paintableVehicle(slot) &&
        (p.fleet ?? [0, 5]).includes(slot) &&
        vehiclePaint(p, slot) !== id
      );
    }
    case 'repair':
      return !!b && b.condition < 100;
    case 'demolish':
      return !!b && !b.government && !b.lien;
    case 'trade':
    case 'work':
    case 'gather':
    case 'construct':
    case 'supply':
    case 'cancelConstruction':
      return free;
    case 'livestock':
      return free && !!b && (b.owner === p.id || p.job === b.id);
    case 'buyBuilding':
      return free && !!b && !b.government && b.owner !== p.id && (!b.owner || !!b.forSale);
    case 'takeoff':
      return free && !p.game && !aboardBoat(w, p);
  }
}

/** Recoverable requirements leave a disabled control with a concrete explanation. */
export function actionBlocker(w: World, p: Player, action: string, id?: string, b?: Building) {
  if (
    b &&
    ['buyBuilding', 'vehicle', 'job', 'task', 'farm', 'learn', 'home'].includes(action) &&
    !(b.kind === 'boathouse' ? nearBoathouse(w, p, b) : Math.hypot(p.x - b.x, p.z - b.z) < 18)
  )
    return 'Move within 18 metres of this building';
  if (action === 'buyBuilding' && b && p.cash < propertyQuote(w, b).total)
    return 'Not enough cash to buy this property';
  if (action === 'walk' || action === 'tractor' || action === 'vehicle') {
    const slot = action === 'walk' ? 5 : action === 'tractor' ? returnTractor(p) : Number(id);
    if (slot === 2 && hasAircraftHangar(w) && !b?.aircraftHangar)
      return 'Visit the airfield hangar';
    if (slot === 2 && Math.abs(p.speed) >= 0.5) return 'Stop before boarding';
    if (
      stockWeight(w, p.inventory) + (slot === FISHING_BOAT ? stockWeight(w, p.boatStores) : 0) >
      vehicles[slot].capacity
    )
      return 'Unload cargo before changing to a smaller vehicle';
    if (
      action === 'vehicle' &&
      !(slot === 2 ? aircraftCount(p) > 0 : (p.fleet ?? [0, 5]).includes(slot)) &&
      p.cash < vehicles[slot].price
    )
      return 'Not enough cash';
    const licence = requiredLicence(w, slot);
    if (licence && !p.skills.includes(licence)) return `Learn ${licence} at school first`;
  }
  if (action === 'farm' && id !== 'expand' && !p.skills.includes('farmer'))
    return 'Learn Farmer at school first';
  if (action === 'job' && b) {
    const recipe = b.kind === 'farm' ? recipes.farm : (b.production ?? recipes[b.recipe ?? '']);
    if (recipe && !p.skills.includes(recipe.skill)) return `Learn ${recipe.skill} at school first`;
    if ((b.dismissedUntil?.[p.id] ?? 0) > w.time)
      return 'Recently dismissed; reapply after one hour';
    if (!jobVacancy(w, b, p.id)) return `All jobs filled (hiring limit ${hiringLimit(w, b)})`;
  }
  if (action === 'joinGame' && id === 'fishing' && !(p.inventory.tackle > 0))
    return 'Carry Fishing tackle';
}

/** Update existing elements, preserving focused fields and panel scroll position. */
export function refreshActionVisibility(host: HTMLElement, w: World, p: Player) {
  for (const el of host.querySelectorAll<HTMLElement>('[data-do], form[data-action]')) {
    const form = el instanceof HTMLFormElement ? el : undefined;
    const value = (key: string) =>
      (form?.elements.namedItem(key) as HTMLInputElement | null)?.value;
    const action = form ? form.dataset.action! : el.dataset.do!;
    const b = w.buildings.find((b) => b.id === (el.dataset.building ?? value('building')));
    const visible = actionVisible(
      w,
      p,
      action,
      el.dataset.id ?? value('operation'),
      b,
      Number(el.dataset.plot ?? value('plot')),
      el.dataset.vehicle === undefined ? undefined : Number(el.dataset.vehicle),
    );
    if (visible !== undefined) el.hidden = !visible;
    if (form && b && action !== 'farm') {
      if (visible === undefined) form.hidden = !!p.crowBody;
      for (const submit of form.querySelectorAll<HTMLButtonElement>(
        'button:not([type="button"])',
      )) {
        const blocked = !(b.kind === 'boathouse'
          ? nearBoathouse(w, p, b)
          : Math.hypot(p.x - b.x, p.z - b.z) < 18);
        // These forms otherwise validate their numeric inputs on the server.
        if (['stock', 'investment', 'buildingAdmin', 'listProperty'].includes(action)) {
          submit.disabled = blocked;
          submit.title = blocked ? 'Move within 18 metres of this building' : '';
        }
      }
    }
    const reason = actionBlocker(w, p, action, el.dataset.id ?? value('operation'), b);
    const buttons = form
      ? form.querySelectorAll<HTMLButtonElement>('button:not([type="button"])')
      : el instanceof HTMLButtonElement
        ? [el]
        : [];
    for (const button of buttons) {
      if (reason) {
        if (!button.dataset.contextBlocked) {
          button.dataset.contextDisabled = String(button.disabled);
          button.dataset.contextTitle = button.title;
        }
        button.dataset.contextBlocked = 'true';
        button.disabled = true;
        button.title = reason;
      } else if (button.dataset.contextBlocked) {
        button.disabled = button.dataset.contextDisabled === 'true';
        button.title = button.dataset.contextTitle ?? '';
        delete button.dataset.contextBlocked;
        delete button.dataset.contextDisabled;
        delete button.dataset.contextTitle;
      }
    }
    if (action === 'crow') el.textContent = p.crowBody ? 'Return to body' : 'Fly robocrow';
    if (action === 'reel' && el instanceof HTMLButtonElement)
      el.disabled = p.fishAt === undefined || w.time < p.fishAt || w.time > (p.fishUntil ?? 0);
  }
}
