// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, World } from './types';
import { CHARTER_BOAT, boatSlot } from './boats';
import { boatLanding } from './boathouse';
import { blocksBuilding } from './building-shapes';
import { creatorBlocks } from './creator';
import { fishingDock, travelHeight } from './dock';
import { log, say } from './simulation';
export interface CharterOffer {
  fare: number;
  minutes: number;
  dock: string;
}
export interface CharterTrip {
  offers: Record<string, CharterOffer>;
  tickets: Record<string, CharterOffer>;
  dock: string;
  elapsed: number;
  departed: boolean;
  returned: boolean;
}
export interface CharterPassage extends CharterOffer {
  captain: string;
}
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
/** Either side of the public pier counts as returning to the same departure facility. */
export function sameCharterDock(a: string | undefined, b: string) {
  return a === b || (!!a?.startsWith(`${fishingDock.id}:`) && b.startsWith(`${fishingDock.id}:`));
}
export function charterCaptain(w: World, p: Player) {
  const c = p.hitch ? w.players[p.hitch] : undefined;
  // The private ticket is also supplied in client snapshots; the server always checks its ledger.
  return c?.vehicle === CHARTER_BOAT && p.charterPassage?.captain === c.id ? c : undefined;
}
export function charterOffers(w: World, p: Player) {
  return Object.values(w.players)
    .filter((c) => c.charter?.offers[p.id] && !c.charter.departed)
    .map((c) => ({ ...c.charter!.offers[p.id], captain: c.id, name: c.name }));
}
export function stopAngling(p: Player) {
  if (p.game === 'fishing') delete p.game;
  delete p.fishAt;
  delete p.fishUntil;
  delete p.fishCatch;
}
/** Settlement is idempotent; escrow is persisted on the captain, never credited early. */
export function settleCharterPassenger(w: World, captain: Player, p: Player, cancelled = false) {
  const v = captain.charter,
    t = v?.tickets[p.id];
  if (!v || !t) {
    delete p.charterPassage;
    return;
  }
  const paid = cancelled ? 0 : Math.floor(t.fare * Math.min(1, v.elapsed / (t.minutes * 60)));
  captain.cash += paid;
  p.cash += t.fare - paid;
  // Only the final earned fare counts as spending/income, not the deposit or refund.
  log(w, 'transfer', paid, p.id, captain.id, 'charter fare');
  delete v.tickets[p.id];
  delete p.charterPassage;
  stopAngling(p);
  say(
    w,
    'Charter',
    `Trip settled: ${(paid / 100).toFixed(2)}d fare; ${((t.fare - paid) / 100).toFixed(2)}d refunded. You keep your catch.`,
    'system',
    p.id,
  );
}
export function charterAction(w: World, p: Player, a: Action) {
  if (a.operation === 'accept' || a.operation === 'decline') {
    const c = w.players[String(a.captain)],
      v = c?.charter,
      t = v?.offers[p.id];
    need(c && v && t, 'That charter offer is no longer available');
    if (a.operation === 'decline') {
      delete v!.offers[p.id];
      return 'Charter declined';
    }
    need(
      !v!.departed &&
        c.vehicle === CHARTER_BOAT &&
        !c.hitch &&
        c.online &&
        Math.abs(c.speed) < 0.5 &&
        boatLanding(w, c, true, t!.dock) &&
        boatLanding(w, p, false, t!.dock),
      'Both of you must be at the departure dock',
    );
    need(
      !p.hitch &&
        !p.charterPassage &&
        !p.atHome &&
        !p.task &&
        !p.game &&
        !p.crowBody &&
        !boatSlot(p.vehicle, w) &&
        Math.abs(p.speed) < 0.5 &&
        Math.abs(p.y - travelHeight(w, p.x, p.z)) < 2,
      'Finish your activity on shore before boarding',
    );
    need(
      Object.values(w.players).filter((q) => q.hitch === c.id).length < 6,
      'All six passenger places are occupied',
    );
    need(p.cash >= t!.fare, 'Not enough cash for the agreed fare');
    p.cash -= t!.fare;
    v!.tickets[p.id] = { ...t! };
    p.charterPassage = { ...t!, captain: c.id };
    delete v!.offers[p.id];
    p.hitch = c.id;
    Object.assign(p, { x: c.x, z: c.z, y: c.y + 1.2, speed: 0 });
    return `Boarded ${c.name}'s charter. Fare held until return; bring your own tackle, food and water. Your catch is yours.`;
  }
  if (a.operation === 'requestReturn') {
    const c = charterCaptain(w, p);
    need(c, 'You are not aboard a charter');
    need(w.time >= (p.charterRequestAt ?? -Infinity) + 60, 'The captain has already been notified');
    p.charterRequestAt = w.time;
    say(w, 'Charter', `${p.name} requests a return to port.`, 'system', c!.id);
    return 'The captain has been asked to return';
  }
  need(p.vehicle === CHARTER_BOAT && !p.hitch && !p.atHome, 'Board your charter boat as captain');
  const dock = boatLanding(w, p, true);
  need(dock && Math.abs(p.speed) < 0.5, 'Stop at a dock first');
  if (a.operation === 'offer') {
    const q = w.players[String(a.player)],
      fare = Number(a.fare),
      minutes = Number(a.minutes);
    need(
      q && q.id !== p.id && q.online && !q.hitch && boatLanding(w, q, false, dock!.id),
      'Choose a passenger waiting on shore at this dock',
    );
    need(
      Number.isSafeInteger(fare) && fare >= 0 && fare <= 100000,
      'Fare must be between 0 and 1000d',
    );
    need(
      Number.isSafeInteger(minutes) && minutes >= 15 && minutes <= 180,
      'Choose 15–180 real minutes, including travel',
    );
    need(!p.charter?.departed, 'Finish the current charter before offering a new trip');
    need(
      !p.charter || sameCharterDock(p.charter.dock, dock!.id),
      'Finish or cancel the previous charter first',
    );
    const v = (p.charter ??= {
      offers: {},
      tickets: {},
      dock: dock!.id,
      elapsed: 0,
      departed: false,
      returned: false,
    });
    need(Object.keys(v.offers).length < 16 || !!v.offers[q!.id], 'Too many outstanding offers');
    v.offers[q!.id] = { fare, minutes, dock: dock!.id };
    say(
      w,
      'Charter',
      `${p.name} offers a ${minutes}-minute fishing trip for ${(fare / 100).toFixed(2)}d, including travel. Open Inventory → Boating to accept. Bring tackle and provisions; keep your catches. Early returns receive a proportional refund.`,
      'system',
      q!.id,
    );
    return 'Charter offer sent';
  }
  need(a.operation === 'finish' || a.operation === 'cancel', 'Unknown charter operation');
  need(p.charter, 'No charter to finish');
  const v = p.charter!;
  const land = dock!.land;
  need(
    !w.buildings.some((b) => blocksBuilding(b, land.x, land.z, 0, 1.5)) &&
      !creatorBlocks(w, land.x, land.z, travelHeight(w, land.x, land.z), 1.5),
    'The shore landing is blocked; clear it or use another dock',
  );
  // Returning elsewhere is allowed for safety, but cannot earn the agreed return fare.
  const cancelled = a.operation === 'cancel' || !sameCharterDock(v.dock, dock!.id);
  for (const id of Object.keys(v.tickets)) {
    const q = w.players[id];
    if (!q) continue;
    settleCharterPassenger(w, p, q, cancelled);
    delete q.hitch;
    Object.assign(q, dock!.land, { y: travelHeight(w, dock!.land.x, dock!.land.z), speed: 0 });
  }
  delete p.charter;
  return cancelled
    ? 'Charter cancelled; all fares refunded and passengers ashore'
    : 'Charter settled; passengers and their catches are ashore';
}
export function advanceCharters(w: World, seconds: number) {
  for (const c of Object.values(w.players)) {
    const v = c.charter;
    if (!v) continue;
    if (c.vehicle !== CHARTER_BOAT || c.hitch) {
      cancelChartersOnDeath(w, c);
      continue;
    }
    const oldElapsed = v.elapsed;
    const dock = boatLanding(w, c, true);
    if (!dock && !v.departed) {
      v.departed = true;
      v.offers = {};
    }
    if (v.departed && !v.returned) {
      if (dock && Math.abs(c.speed) < 0.5) v.returned = true;
      else v.elapsed = Math.min(10800, v.elapsed + seconds);
    }
    for (const [id, t] of Object.entries(v.tickets)) {
      const q = w.players[id];
      if (!q) continue;
      if (q.hitch !== c.id) {
        settleCharterPassenger(w, c, q, true);
        continue;
      }
      if (q.game === 'fishing' && Math.abs(c.speed) >= 0.5) {
        stopAngling(q);
        say(
          w,
          'Charter',
          'The boat is moving. Your line has been reeled in; cast again when stopped.',
          'system',
          id,
        );
      }
      if (v.elapsed >= t.minutes * 60 && oldElapsed < t.minutes * 60) {
        say(
          w,
          'Charter',
          `${q.name}'s agreed trip time is up. Return to port; no extra fare is charged.`,
          'system',
          c.id,
        );
        say(
          w,
          'Charter',
          'Your agreed trip time is up. The captain has been asked to return.',
          'system',
          id,
        );
      }
    }
  }
}
export function cancelChartersOnDeath(w: World, p: Player) {
  const c = p.charterPassage && w.players[p.charterPassage.captain];
  if (c) settleCharterPassenger(w, c, p, true);
  if (p.charter) {
    for (const id of Object.keys(p.charter.tickets))
      if (w.players[id]) settleCharterPassenger(w, p, w.players[id], true);
    delete p.charter;
  }
}
/** Six rail stations, with clear central access to the cabin. */
export function charterPassengerPosition(index: number): [number, number, number] {
  return [index % 2 ? 1.85 : -1.85, 1.05, -0.8 - Math.floor(index / 2) * 1.7];
}
