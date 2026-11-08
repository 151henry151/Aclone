import { advanceBridgeInspections } from './bridge-inspection';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Action, Player, World, Settings } from './types';
import type { Point } from './town';
import type { Bridge, BridgeBill, BridgePlan, BridgeMaterial } from './bridge-types';
import { bridgeRules } from './bridge-rules';
import { surveyBridgeSteps, bridgePermissionReason } from './bridge-survey';
import { roadGeometryKey, type RoadWork } from './road-work';
import {
  bridgeReservedFootprint,
  bridgeAccessReason,
  bridgeSiteVehicleBlocked,
} from './bridge-geometry';
import { rectanglesOverlap, vehicleFootprint, trailerFootprint } from './vehicle-footprint';
import { DAY_SECONDS } from './environment';
import { pointDistance } from './road-routing';
const materials: BridgeMaterial[] = ['steel', 'wood', 'gravel', 'stone'];
const emptyBill = (): BridgeBill => ({
  cash: 0,
  materials: { steel: 0, wood: 0, gravel: 0, stone: 0 },
});
type SurveyJob = { id: string; geometry: string; steps?: RoadWork<BridgePlan>; plan?: BridgePlan };
const surveys = new WeakMap<World, Map<string, SurveyJob>>();
let quoteSequence = 0;
function geometry(w: World) {
  return roadGeometryKey(w);
}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
function amount(value: unknown, label: string): number {
  check(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
    `Invalid ${label} amount`,
  );
  return value;
}
function near(w: World, p: Player, plan: Pick<BridgePlan, 'a' | 'b' | 'approachA' | 'approachB'>) {
  check(
    [plan.a, plan.b, plan.approachA, plan.approachB].some(
      (q) => pointDistance(p, q) <= bridgeRules(w.settings).bridgeServiceReach,
    ),
    'Move near a bridge office at either end first',
  );
}
function permission(w: World, p: Player, plan: BridgePlan) {
  const refusal = bridgePermissionReason(w, p.id, plan);
  check(!refusal, refusal ?? 'Bridge permission denied');
}
function completed(w: World, b: Bridge) {
  if (
    b.completedAt === undefined &&
    b.paid.cash === b.bill.cash &&
    materials.every((k) => b.paid.materials[k] === b.bill.materials[k])
  ) {
    b.completedAt = w.time;
    b.condition = 100;
    b.wearAt = w.time;
  }
}
export function bridgeOccupied(w: World, b: Bridge) {
  const rect = bridgeReservedFootprint(b);
  return (
    Object.values(w.players).some(
      (p) => !p.inside && rectanglesOverlap(rect, vehicleFootprint(w, p.vehicle, p)),
    ) ||
    Object.values(w.parkedVehicles ?? {}).some(
      (p) => !p.inside && rectanglesOverlap(rect, vehicleFootprint(w, p.slot, p)),
    ) ||
    Object.values(w.trailers ?? {}).some((t) => rectanglesOverlap(rect, trailerFootprint(t))) ||
    Object.values(w.mooredBoats ?? {}).some((p) =>
      rectanglesOverlap(rect, vehicleFootprint(w, p.slot, p)),
    )
  );
}
export function bridgeRepairBill(settings: Partial<Settings>, b: BridgePlan): BridgeBill {
  const r = bridgeRules(settings),
    area = Math.round(pointDistance(b.a, b.b) * b.width * 1e6) / 1e6;
  const bill = emptyBill();
  bill.cash = Math.ceil((r.bridgeRepairCash * area) / r.bridgeRepairReferenceArea);
  bill.materials.steel = Math.ceil((r.bridgeRepairSteel * area) / r.bridgeRepairReferenceArea);
  return bill;
}
export function maintainBridges(w: World) {
  const r = bridgeRules(w.settings);
  for (const b of w.bridges ?? []) {
    if (b.completedAt === undefined) continue;
    const days = Math.floor((w.time - b.wearAt) / DAY_SECONDS);
    if (days <= 0) continue;
    b.wearAt += days * DAY_SECONDS;
    const condition = Math.max(0, b.condition - r.bridgeWearPerDay * days);
    if (b.condition !== condition) {
      b.condition = condition;
      b.revision++;
    }
  }
}
/** Private quotes are runtime capabilities; a saved preview cannot authorize an old quote after restart. */
export function advanceBridgeSurveys(w: World) {
  const jobs = surveys.get(w);
  for (const p of Object.values(w.players))
    if (p.bridgeSurvey?.status === 'pending' && !jobs?.has(p.id))
      p.bridgeSurvey = {
        id: p.bridgeSurvey.id,
        status: 'failed',
        reason: 'Survey interrupted; survey the site again',
      };
  if (!jobs) return;
  const deadline = performance.now() + 4;
  do {
    const pair = [...jobs].find(([, job]) => job.steps);
    if (!pair) break;
    const [id, job] = pair,
      p = w.players[id];
    if (!p) {
      jobs.delete(id);
      continue;
    }
    try {
      const next = job.steps!.next();
      if (next.done) {
        check(
          job.geometry === geometry(w),
          'The site or rules changed during the survey; survey again',
        );
        const plan = next.value;
        check(
          !(w.bridges ?? []).some((b) =>
            rectanglesOverlap(bridgeReservedFootprint(b), bridgeReservedFootprint(plan)),
          ),
          'Bridge site overlaps an existing project',
        );
        job.plan = plan;
        delete job.steps;
        p.bridgeSurvey = { id: job.id, status: 'ready', plan };
      }
    } catch (error) {
      p.bridgeSurvey = {
        id: job.id,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Survey failed',
      };
      jobs.delete(id);
    }
    // Round-robin so one large crossing cannot starve another player's preview.
    if (jobs.has(id)) {
      jobs.delete(id);
      jobs.set(id, job);
    }
  } while (performance.now() < deadline);
}

export function bridgeAction(
  w: World,
  p: Player,
  action: Action,
  charge: (cash: number, reason: string) => void,
): string {
  const r = bridgeRules(w.settings);
  if (action.op === 'survey') {
    check(r.bridgeBuilding, 'Bridge construction is disabled in this world');
    const a = action.a as Point,
      b = action.b as Point;
    check(
      a && b && [a.x, a.z, b.x, b.z].every(Number.isFinite),
      'Choose two finite bank positions',
    );
    check(action.design === 'narrow' || action.design === 'wide', 'Choose a bridge design');
    check(
      Math.min(pointDistance(p, a), pointDistance(p, b)) <= r.bridgeServiceReach,
      'Move near a bank before surveying',
    );
    const id = `${p.id}:${++quoteSequence}`,
      jobs = surveys.get(w) ?? new Map<string, SurveyJob>();
    jobs.set(p.id, {
      id,
      geometry: geometry(w),
      steps: surveyBridgeSteps(w, p.id, a, b, action.design),
    });
    surveys.set(w, jobs);
    p.bridgeSurvey = { id, status: 'pending' };
    return 'Surveying the river banks, clearance and approaches';
  }
  if (action.op === 'found') {
    check(r.bridgeBuilding, 'Bridge construction is disabled in this world');
    const job = surveys.get(w)?.get(p.id);
    check(
      job?.plan && job.id === action.quote,
      'Survey again: this quote is missing, expired or already used',
    );
    check(job.geometry === geometry(w), 'The site or rules changed; survey again');
    const plan = job.plan;
    near(w, p, plan);
    permission(w, p, plan);
    check(
      (w.bridges?.length ?? 0) < r.bridgeMaximumCount,
      'This world has reached its bridge limit',
    );
    check(
      (w.bridges ?? []).filter((b) => b.owner === p.id && b.completedAt === undefined).length <
        r.bridgeProjectsPerPlayer,
      'Finish an existing bridge project first',
    );
    check(
      !(w.bridges ?? []).some((b) =>
        rectanglesOverlap(bridgeReservedFootprint(b), bridgeReservedFootprint(plan)),
      ),
      'Bridge site overlaps an existing project',
    );
    check(
      !bridgeSiteVehicleBlocked(w, plan),
      'Move parked vehicles, trailers and moored boats clear of the bridge footprint',
    );
    const deposit = Math.ceil(plan.bill.cash * r.bridgeDepositFraction);
    check(p.cash >= deposit, 'Not enough cash for the bridge deposit');
    const paid = emptyBill();
    paid.cash = deposit;
    const bridge: Bridge = {
      ...structuredClone(plan),
      id: `bridge:${(w.bridgeSequence ?? 0) + 1}`,
      owner: p.id,
      foundedAt: w.time,
      condition: 100,
      wearAt: w.time,
      revision: 1,
      paid,
      contributors: { [p.id]: structuredClone(paid) },
    };
    charge(deposit, 'Bridge founding deposit');
    w.bridgeSequence = (w.bridgeSequence ?? 0) + 1;
    (w.bridges ??= []).push(bridge);
    completed(w, bridge);
    advanceBridgeInspections(w, bridge);
    surveys.get(w)!.delete(p.id);
    delete p.bridgeSurvey;
    return 'Bridge site reserved. Contributions are final; deliver the remaining cash and materials';
  }
  const b = w.bridges?.find((b) => b.id === action.bridge);
  check(b, 'Bridge not found');
  near(w, p, b);
  if (action.op === 'contribute') {
    advanceBridgeInspections(w);
    check(!b.closure, b.closure ?? 'Bridge safety check required');
    check(b.completedAt === undefined, 'This bridge is already complete');
    check(
      action.revision === b.revision,
      'The project changed; review the remaining bill before contributing',
    );
    permission(w, p, b);
    const cash = amount(action.cash, 'cash'),
      input = action.materials;
    check(
      input && typeof input === 'object' && !Array.isArray(input),
      'Choose explicit material amounts',
    );
    check(
      Object.keys(input).every((k) => materials.includes(k as BridgeMaterial)),
      'Unknown bridge material',
    );
    const stock = input as Record<string, unknown>,
      donation = emptyBill();
    donation.cash = cash;
    for (const k of materials) {
      const n = amount(stock[k] ?? 0, k);
      donation.materials[k] = n;
      check(n <= (p.inventory[k] ?? 0), `Not enough ${k} material`);
      check(
        n <= b.bill.materials[k] - b.paid.materials[k],
        `Amount exceeds the remaining ${k} bill`,
      );
    }
    check(cash <= b.bill.cash - b.paid.cash, 'Cash exceeds the remaining bridge bill');
    check(p.cash >= cash, 'Not enough cash');
    check(
      cash > 0 || materials.some((k) => donation.materials[k] > 0),
      'Choose a positive contribution',
    );
    // Every refusal precedes all resource mutation.
    charge(cash, 'Bridge contribution');
    const total = (b.contributors[p.id] ??= emptyBill());
    b.paid.cash += cash;
    total.cash += cash;
    for (const k of materials) {
      const n = donation.materials[k];
      p.inventory[k] = (p.inventory[k] ?? 0) - n;
      b.paid.materials[k] += n;
      total.materials[k] += n;
    }
    b.revision++;
    completed(w, b);
    return b.completedAt === undefined
      ? 'Contribution accepted; the bridge still needs funding'
      : 'Bridge complete';
  }
  if (action.op === 'passage') {
    const reason = bridgeAccessReason(w, p, b);
    check(!reason, reason ?? 'Bridge inaccessible');
    check(!p.bridgePasses?.[b.id], 'You already have passage across this bridge');
    charge(b.owner === p.id ? 0 : r.bridgeToll, 'Bridge passage');
    p.bridgePasses = { ...p.bridgePasses, [b.id]: { entered: false } };
    return 'Passage purchased; reverse or retreat without paying again';
  }
  if (action.op === 'repair') {
    check(b.completedAt !== undefined, 'Complete construction before repairing');
    check(action.revision === b.revision, 'Bridge condition changed; review the repair quote');
    check(r.bridgePublicAccess || b.owner === p.id, 'This bridge is private; owner access only');
    check(b.condition < 100, 'The bridge needs no repair');
    const repair = bridgeRepairBill(w.settings, b),
      cash = repair.cash,
      steel = repair.materials.steel;
    check(p.cash >= cash, 'Not enough cash for bridge repair');
    check((p.inventory.steel ?? 0) >= steel, 'Not enough steel for bridge repair');
    charge(cash, 'Bridge repair');
    p.inventory.steel = (p.inventory.steel ?? 0) - steel;
    b.condition = Math.min(100, b.condition + r.bridgeRepairCondition);
    b.revision++;
    return 'Bridge repaired';
  }
  if (action.op === 'remove') {
    check(
      b.owner === p.id || p.authority >= 20,
      'Only the bridge owner or world administrator can remove it',
    );
    check(action.revision === b.revision, 'Bridge changed; review removal again');
    check(
      !bridgeOccupied(w, b),
      'Bridge footprint is occupied; clear all people, vehicles and trailers first',
    );
    w.bridges = w.bridges!.filter((bridge) => bridge !== b);
    for (const person of Object.values(w.players))
      if (person.bridgePasses?.[b.id]) {
        person.bridgePasses = { ...person.bridgePasses };
        delete person.bridgePasses[b.id];
      }
    return 'Bridge removed; contributed cash and materials are not refundable';
  }
  throw Error('Unknown bridge action');
}
