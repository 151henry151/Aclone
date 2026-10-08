// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { distance } from '../../shared/simulation.ts';
import type { ResidentState } from './memory.ts';
import type { FarmerChoice } from './farmer.ts';
import { blockedStep } from './recovery.ts';
import { visitBuilding } from './care.ts';
function visibleBuilding(b: Building, p: Player): Building {
  const snapshot = structuredClone(b);
  delete snapshot.accounts;
  if (snapshot.lodging)
    for (const [id, guest] of Object.entries(snapshot.lodging.guests))
      if (id !== p.id) guest.stock = {};
  return snapshot;
}
/** Last-known quotes stay in the parish model for a full day of world time. */
export const marketMemorySeconds = 86400;
/** Wander back after an hour so the model does not go stale. */
export const marketFreshSeconds = 3600;
export interface MarketMemory {
  world: string;
  visits: Record<
    string,
    { at: number; building: Building; staff: { id: string; activeUntil: number }[] }
  >;
}
/** Only visits reveal another business's changing conditions. Names and locations
 * are public map knowledge. Old quotes are memories, never guaranteed offers. */
export function rememberMarkets(w: World, p: Player, state: ResidentState) {
  if (state.markets?.world !== w.id) state.markets = { world: w.id, visits: {} };
  const visits = state.markets.visits;
  for (const b of w.buildings) {
    if (distance(p, b) >= 18 && b.owner !== p.id) continue;
    const old = visits[b.id];
    if (old && w.time - old.at < 2) continue;
    const snapshot = visibleBuilding(b, p);
    visits[b.id] = {
      at: w.time,
      building: snapshot,
      staff: b.employees.map((id) => ({ id, activeUntil: w.players[id]?.activeUntil ?? 0 })),
    };
  }
  for (const id of Object.keys(visits))
    if (!w.buildings.some((b) => b.id === id)) delete visits[id];
}
export function marketKnowledge(w: World, state: ResidentState, omniscient = false) {
  return {
    scope: omniscient
      ? 'Current public markets: parish guide privilege.'
      : 'Visited businesses and my property stay in my parish model. Quotes may change; walk back to refresh. Unseen shops are UNKNOWN, not empty.',
    directory: w.buildings.map((b) => ({
      id: b.id,
      name: b.name,
      kind: b.kind,
      x: b.x,
      z: b.z,
      observedAt: state.markets?.world === w.id ? (state.markets.visits[b.id]?.at ?? null) : null,
    })),
  };
}
/** All planners, local care and chat use this same view, including candidate
 * eligibility dry-runs. Hiding fields only in the prompt would still leak prices. */
export function perceivedWorld(
  w: World,
  p: Player,
  state: ResidentState,
  omniscient = false,
): World {
  rememberMarkets(w, p, state);
  if (omniscient)
    return {
      ...w,
      buildings: w.buildings.map((b) => visibleBuilding(b, p)),
      players: {
        [p.id]: p,
        ...Object.fromEntries(
          Object.values(w.players)
            .filter((q) => q.id !== p.id)
            .map((q) => [
              q.id,
              {
                ...p,
                id: q.id,
                name: q.name,
                job: q.job,
                activeUntil: q.activeUntil,
                skills: [],
                inventory: {},
                cash: 0,
                bank: 0,
                loans: [],
                history: [],
              },
            ]),
        ),
      },
      ledger: w.ledger.filter((e) => e.to === p.id || e.from === p.id),
      messages: [],
    };
  const visits = state.markets!.visits;
  const buildings = w.buildings.flatMap((b) => {
    const v = visits[b.id];
    if (b.owner === p.id || b.id === p.job || distance(p, b) < 18) return [visibleBuilding(b, p)];
    if (v && w.time - v.at <= marketMemorySeconds)
      return [v.building.owner === p.id ? { ...v.building, owner: 'unknown' } : v.building];
    return [];
  });
  const players = { [p.id]: p };
  // Staffing was visible at inspection, not a fresh query of remote workers.
  for (const v of Object.values(visits))
    for (const staff of v.staff) {
      if (staff.id === p.id) continue;
      players[staff.id] = {
        ...p,
        id: staff.id,
        name: 'Observed employee',
        job: v.building.id,
        activeUntil: staff.activeUntil,
        skills: [],
        online: false,
        inventory: {},
        cash: 0,
        bank: 0,
        loans: [],
        history: [],
      };
    }
  return {
    ...w,
    buildings,
    players,
    messages: [],
    ledger: w.ledger.filter((e) => e.to === p.id || e.from === p.id),
  };
}
export function inspectionChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  if (p.task) return [];
  const visits = state.markets?.world === w.id ? state.markets.visits : {};
  const needsTraining = Object.values(visits).some((v) => {
    const r = v.building.production ?? recipes[v.building.recipe ?? ''];
    return (
      r &&
      !p.skills.includes(r.skill) &&
      ((r.outputs.water && p.thirst >= 15000) || (r.outputs.bread && p.hunger >= 15000))
    );
  });
  const inputs = new Set(
    Object.values(visits).flatMap((v) =>
      Object.keys((v.building.production ?? recipes[v.building.recipe ?? ''])?.inputs ?? {}),
    ),
  );
  return w.buildings
    .filter(
      (b) =>
        !b.construction &&
        b.owner !== p.id &&
        (!visits[b.id] || w.time - visits[b.id].at > marketFreshSeconds) &&
        !blockedStep(state.recovery, { kind: 'travel', destination: b.id }, w.time),
    )
    .sort((a, b) => {
      const thirsty = p.thirst >= 15000;
      const hungry = p.hunger >= 15000;
      const priority = (v: Building) =>
        (thirsty && ['waterworks', 'market', 'starport'].includes(v.kind) ? 420 : 0) +
        (hungry && ['bakery', 'market', 'starport', 'pub'].includes(v.kind) ? 400 : 0) +
        (!thirsty && !hungry && ['mill', 'farm'].includes(v.kind) ? 240 : 0) +
        (['bakery', 'waterworks', 'market', 'starport'].includes(v.kind) ? 200 : 0) +
        (v.id === p.job ? 400 : 0) +
        (v.kind === 'school' && needsTraining ? 500 : 0) +
        (['market', 'starport', 'garage'].includes(v.kind) && inputs.has('fuel') ? 150 : 0) +
        (!p.home && ['home', 'bnb', 'hotel'].includes(v.kind) ? 160 : 0) +
        (!visits[v.id] ? 120 : 0) +
        (visits[v.id] ? Math.min(80, Math.floor((w.time - visits[v.id].at) / 120)) : 0);
      return priority(b) - priority(a) || distance(p, a) - distance(p, b);
    })
    .slice(0, 8)
    .map((b) => ({
      id: `inspect_${b.id}`,
      description: visits[b.id]
        ? `Recheck ${b.name} (${b.kind}): last-known stock and prices are getting old; walk over and update my parish model.`
        : `Explore ${b.name} (${b.kind}): I have not learned its stock, prices or vacancies yet.`,
      plan: visitBuilding(p, b, [{ kind: 'wait', seconds: 1 }]),
      reconsiderSeconds: 300,
    }));
}
