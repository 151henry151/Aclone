import { trailerStorage } from './stored-trailers';
import { maximumHealth } from './nutrition';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action, Stock } from './types';
import type { Earthwork, EarthworkJob } from './earthworks-ground';
import { earthworksHeight } from './earthworks-ground';
import { earthworkSiteReason, earthworkBermHeight } from './earthworks-site';
import { constructionRules } from './construction-rules';
import { terrainHeight } from './terrain';
import { BULLDOZER, BACKHOE, isEarthmover } from './earthmoving-definitions';
import { vehicleDef } from './vehicle-config';
import { helmBlock } from './captain';
import { regionalResourceWeights, northernBlend } from './northern-island';
import { gatheringRules } from './gathering-rules';
import { stockWeight } from './fishing-expedition';
import { worldItems } from './world-catalogue';
import { transferStock } from './stock-life';
import { trailerDef, trailerHandlingReach } from './trailers';
import { canCarry } from './simulation';
import {
  earthworkPermissionReason,
  earthworkPropertyOwners,
  approveEarthwork,
  earthworkContractAction,
  earthworkOperatorAllowed,
  refundEarthwork,
  creditEarthwork,
  settleEarthwork,
  newEarthworkOffer,
  withdrawEarthworkSurvey,
} from './earthworks-contracts';

export interface EarthworkInput {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  target: number;
  shoulder: number;
}
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const permitted = (p: Player, pad: Earthwork) =>
  p.id === pad.owner || !!pad.work?.operators.includes(p.id);
function coordinates(pad: Earthwork, x: number, z: number) {
  const c = Math.cos(pad.rotation),
    s = Math.sin(pad.rotation),
    dx = x - pad.x,
    dz = z - pad.z;
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
function within(pad: Earthwork, p: { x: number; z: number }, extra = 0) {
  const q = coordinates(pad, p.x, p.z);
  return Math.abs(q.x) <= pad.width / 2 + extra && Math.abs(q.z) <= pad.depth / 2 + extra;
}
export function earthworkMaterial(w: World, x: number, z: number) {
  const r = constructionRules(w.settings),
    n = w.northernIsland;
  if (!n || northernBlend(n, z) <= 0) return { material: 'dirt' as const, effort: 1 };
  const [, stone, gravel, dirt] = regionalResourceWeights(n, x, z);
  const material = stone > Math.max(gravel, dirt) ? 'stone' : gravel > dirt ? 'gravel' : 'dirt';
  return {
    material,
    effort:
      1 + (r.earthworksStoneEffort - 1) * Math.max(0, (stone - 1) / 0.8) * northernBlend(n, z),
  } as const;
}
/** Read-only integration at the construction survey resolution. Server recomputes on confirm. */
export function surveyEarthwork(
  w: World,
  p: Pick<Player, 'id' | 'vehicle'>,
  input: EarthworkInput,
) {
  const r = constructionRules(w.settings);
  const keys = ['x', 'z', 'width', 'depth', 'rotation', 'target', 'shoulder'] as const;
  for (const key of keys) need(Number.isFinite(input[key]), 'Enter finite survey numbers');
  input = Object.fromEntries(keys.map((key) => [key, input[key]])) as unknown as EarthworkInput;
  need(
    input.width >= 1 &&
      input.depth >= 1 &&
      input.width <= r.earthworksMaximumSide &&
      input.depth <= r.earthworksMaximumSide,
    'Pad side exceeds the world limit',
  );
  need(
    input.shoulder > 0 && input.shoulder <= r.earthworksMaximumShoulder,
    'Shoulder exceeds the world limit',
  );
  let id = `earthwork-${w.time}-${p.id}-${w.earthworks?.length ?? 0}`;
  while (w.earthworks?.some((pad) => pad.id === id)) id += '-';
  const pad: Earthwork = {
    ...input,
    id,
    owner: p.id,
    created: w.time,
    shoulderGrade: r.earthworksMaximumGrade,
    progress: 0,
    finish: 'bare',
  };
  const c = Math.cos(pad.rotation),
    s = Math.sin(pad.rotation);
  const point = (a: number, b: number) => ({ x: pad.x + a * c + b * s, z: pad.z - a * s + b * c });
  let minimum = Infinity,
    maximum = -Infinity;
  const nx = Math.ceil(pad.width / 2),
    nz = Math.ceil(pad.depth / 2);
  for (let i = 0; i <= nx; i++)
    for (let j = 0; j <= nz; j++) {
      const q = point((i / nx - 0.5) * pad.width, (j / nz - 0.5) * pad.depth),
        h = terrainHeight(w, q.x, q.z);
      minimum = Math.min(minimum, h);
      maximum = Math.max(maximum, h);
    }
  const minTarget = maximum - r.earthworksMaximumDepth,
    maxTarget = minimum + r.earthworksMaximumDepth;
  pad.target = Math.max(minTarget, Math.min(maxTarget, pad.target));
  let cut = 0,
    fill = 0;
  const width = pad.width + pad.shoulder * 2,
    depth = pad.depth + pad.shoulder * 2,
    ix = Math.ceil(width / 2),
    iz = Math.ceil(depth / 2),
    area = (width * depth) / (ix * iz);
  const completed = { earthworks: [{ ...pad, progress: 1 }] };
  for (let i = 0; i < ix; i++)
    for (let j = 0; j < iz; j++) {
      const q = point(((i + 0.5) / ix - 0.5) * width, ((j + 0.5) / iz - 0.5) * depth),
        h = terrainHeight(w, q.x, q.z),
        delta = earthworksHeight(completed, q.x, q.z, h) - h;
      cut += Math.max(0, -delta) * area;
      fill += Math.max(0, delta) * area;
    }
  const { material, effort } = earthworkMaterial(w, pad.x, pad.z),
    volume = Math.max(cut, fill);
  const v = vehicleDef(w, isEarthmover(p.vehicle) ? p.vehicle : BULLDOZER),
    perMetre = p.vehicle === BACKHOE ? r.earthworksBackhoeVolume : r.earthworksDozerVolume;
  const travel = (volume * effort) / perMetre,
    speed = Math.min(v.speed, v.offRoadSpeed ?? v.speed, r.earthworksWorkingSpeed);
  const reason =
    minTarget > maxTarget
      ? 'Ground variation exceeds the permitted cut/fill depth'
      : (earthworkPermissionReason(w, p.id, pad) ?? earthworkSiteReason(w, pad));
  return {
    pad,
    minimum,
    maximum,
    minTarget,
    maxTarget,
    cut,
    fill,
    volume,
    material,
    effort,
    travel,
    passes: Math.ceil(travel / pad.depth),
    fuel: (travel / speed) * v.fuel,
    shortfall: Math.max(0, fill - cut),
    reason,
  };
}
function replace(w: World, pad: Earthwork) {
  if (pad.work) {
    const r = constructionRules(w.settings),
      weight = stockWeight(w, pad.work.spoil),
      radius = Math.min(r.earthworksBermRadius, pad.shoulder / 3);
    const offset = pad.width / 2 + pad.shoulder / 2;
    pad = {
      ...pad,
      berm:
        weight > 0
          ? {
              x: pad.x + Math.cos(pad.rotation) * offset,
              z: pad.z - Math.sin(pad.rotation) * offset,
              radius,
              height:
                Math.min(r.earthworksBermHeight, (pad.shoulderGrade / 100) * radius) *
                Math.min(1, weight / r.earthworksBermFullWeight),
            }
          : undefined,
    };
  }
  if (pad.berm) pad.berm.height = earthworkBermHeight(w, pad, pad.berm);
  if (!pad.berm) delete pad.berm;
  w.earthworks = w.earthworks!.map((e) => (e.id === pad.id ? pad : e));
}
function accessibleStock(w: World, p: Player, a: Action): Stock {
  if (!a.trailer) return p.inventory;
  const t = w.trailers?.[String(a.trailer)];
  need(
    t &&
      !trailerStorage(w, t) &&
      t.owner === p.id &&
      Math.hypot(t.x - p.x, t.z - p.z) <= trailerHandlingReach(w, t),
    'Move alongside your own tipping trailer',
  );
  need(t!.kind === 'dump', 'Use a quarry tipping trailer for earthwork material');
  return t!.cargo;
}
function quantity(a: Action) {
  const n = Number(a.quantity);
  need(Number.isSafeInteger(n) && n > 0, 'Choose a positive whole quantity');
  return n;
}
export function earthworkAction(w: World, p: Player, a: Action) {
  const r = constructionRules(w.settings);
  need(
    !p.task && !p.game && !p.hitch && !p.atHome && !p.inside,
    'Finish your activity and go outside first',
  );
  if (a.operation === 'confirm') {
    const input = Object.fromEntries(
      ['x', 'z', 'width', 'depth', 'rotation', 'target', 'shoulder'].map((k) => [k, Number(a[k])]),
    ) as unknown as EarthworkInput;
    need(earthworkSurveyReach(w, p, input).allowed, 'Move closer to survey that pad');
    const survey = surveyEarthwork(w, p, input);
    need(!survey.reason, survey.reason ?? 'Invalid pad');
    const id = survey.pad.id;
    const work: EarthworkJob = {
      cut: survey.cut,
      fill: survey.fill,
      volume: survey.volume,
      done: 0,
      delivered: 0,
      material: survey.material,
      effort: survey.effort,
      active: survey.volume > 1e-8,
      operators: [],
      seconds: 0,
      spoilProduced: 0,
      spoil: {},
      published: w.time,
      weatherDays: 0,
    };
    const owners = earthworkPropertyOwners(w, survey.pad);
    if (a.fee !== undefined) {
      need(!owners.length, 'Obtain property confirmation before posting this contract');
      work.contract = newEarthworkOffer(w, Number(a.fee), a.fillBy);
    }
    if (owners.length)
      Object.assign(work, {
        approvalOwners: owners,
        approvedBy: [],
        pendingApproval: true,
        active: false,
      });
    w.earthworks = [
      ...(w.earthworks ?? []),
      { ...survey.pad, id, progress: work.pendingApproval || work.active ? 0 : 1, work },
    ];
    return work.pendingApproval
      ? 'Survey awaiting property owner confirmation; land is not reserved yet.'
      : 'Earthwork surveyed and reserved.';
  }
  const pad = w.earthworks?.find((e) => e.id === a.id);
  need(pad?.work, 'Choose a working earthwork pad');
  const job = pad!.work!;
  if (a.operation === 'withdrawSurvey') return withdrawEarthworkSurvey(w, p, pad!);
  if (a.operation === 'approve') return approveEarthwork(w, p, pad!);
  if (['offer', 'accept', 'cancelOffer'].includes(String(a.operation)))
    return earthworkContractAction(w, p, pad!, a);
  need(permitted(p, pad!), 'The site owner must consent to this operator');
  need(!job.pendingApproval, 'Wait for property owner confirmation');
  need(within(pad!, p, r.earthworksTransferReach), 'Move alongside the earthwork site');
  if (a.operation === 'consent') {
    need(p.id === pad!.owner, 'Only the site owner may give permission');
    const operator = String(a.operator);
    need(w.players[operator], 'Choose an existing operator');
    replace(w, {
      ...pad!,
      work: { ...job, operators: [...new Set([...job.operators, operator])] },
    });
    return 'Operator permission recorded.';
  }
  if (a.operation === 'abandon' || a.operation === 'resume') {
    need(pad!.progress < 1, 'This pad is complete');
    if (a.operation === 'abandon' && !job.active)
      return 'Work is already stopped; no further refund is due.';
    need(
      earthworkOperatorAllowed(pad!, p.id),
      'Only the current operator or client may stop this contract',
    );
    if (a.operation === 'resume') {
      const permission =
        earthworkPermissionReason(w, pad!.owner, pad!) ?? earthworkPermissionReason(w, p.id, pad!);
      need(!permission, permission ?? 'Earthworks permission refused');
      need(
        !earthworkSiteReason(w, pad!),
        earthworkSiteReason(w, pad!) ?? 'Site is no longer clear',
      );
    }
    if (a.operation === 'abandon') refundEarthwork(w, pad!);
    replace(w, { ...pad!, work: { ...job, active: a.operation === 'resume' } });
    return a.operation === 'resume' ? 'Work resumed.' : 'Work stopped; the partial ground remains.';
  }
  if (a.operation === 'deliver') {
    const n = quantity(a),
      item = String(a.item);
    need(item === 'dirt' || item === 'gravel', 'Deliver Topsoil or Gravel');
    const source = accessibleStock(w, p, a);
    need((source[item] ?? 0) >= n, 'Not enough supplied material');
    const shortfall = Math.max(0, job.fill - job.cut - job.delivered);
    need(n <= Math.ceil(shortfall / r.earthworksFillVolume), 'No more fill is needed');
    // A separate receipt consumes material once; terrain progress never charges inventory.
    transferStock(w, source, {}, item, n);
    replace(w, {
      ...pad!,
      work: { ...job, delivered: job.delivered + n * r.earthworksFillVolume },
    });
    return 'Fill delivered.';
  }
  if (a.operation === 'gravel') {
    need(pad!.progress === 1, 'Finish grading before spreading gravel');
    need(pad!.finish !== 'gravel', 'This pad already has gravel');
    const n = Math.ceil((pad!.width * pad!.depth) / r.earthworksGravelArea),
      source = accessibleStock(w, p, a);
    need((source.gravel ?? 0) >= n, `Supply ${n} Gravel to finish this pad`);
    transferStock(w, source, {}, 'gravel', n);
    replace(w, { ...pad!, finish: 'gravel', work: { ...job, weatherDays: 0 } });
    return 'Gravel spread.';
  }
  if (a.operation === 'unload' || a.operation === 'collect') {
    const n = quantity(a),
      item = String(a.item);
    need(['dirt', 'gravel', 'stone'].includes(item), 'Choose a spoil material');
    const source = a.operation === 'collect' ? job.spoil : p.earthmovingCargo?.[p.vehicle];
    need(source && (source[item] ?? 0) >= n, 'Not enough spoil');
    const dest = a.operation === 'unload' && !a.trailer ? job.spoil : accessibleStock(w, p, a);
    need(source !== dest, 'Choose another spoil store');
    if (dest === p.inventory) need(canCarry(p, item, n, w), 'Make room in your inventory');
    else {
      const capacity =
        dest === job.spoil
          ? r.earthworksHeapCapacity
          : trailerDef(w, w.trailers![String(a.trailer)].kind).capacity;
      need(
        stockWeight(w, dest) + worldItems(w)[item].weight * n <= capacity,
        'Not enough room in the spoil store',
      );
    }
    transferStock(w, source!, dest, item, n);
    replace(w, { ...pad!, work: { ...job } });
    return 'Spoil transferred.';
  }
  throw Error('Unknown earthwork operation');
}
/** One read-only explanation for the local operator, using the server's work rules. */
export function earthworkGuidance(w: World, p: Player, preferred?: string) {
  if (!isEarthmover(p.vehicle) || p.inside || p.atHome || p.hitch || p.game || p.task) return;
  const jobs = (w.earthworks ?? []).filter(
    (e) => e.work && permitted(p, e) && earthworkOperatorAllowed(e, p.id),
  );
  const pad =
    jobs.find((e) => e.id === preferred) ??
    jobs.sort(
      (a, b) =>
        Number(a.progress === 1 || !a.work!.active) - Number(b.progress === 1 || !b.work!.active) ||
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
  const result = (phase: string, message: string) => ({
    pad,
    phase,
    message,
    distance: pad ? Math.hypot(p.x - pad.x, p.z - pad.z) : 0,
    progress: pad?.work?.volume
      ? Math.min(1, pad.work.done / pad.work.volume)
      : (pad?.progress ?? 0),
  });
  if (!pad)
    return result('empty', 'Open Earthworks to survey an area here. No building plan is needed.');
  if (pad.progress === 1)
    return result(
      'complete',
      'Finished — this ground is level. You can leave it as it is or build on it.',
    );
  if (pad.work!.pendingApproval)
    return result(
      'permission',
      'Wait for the property owner to approve this survey in Earthworks.',
    );
  if (!pad.work!.active)
    return result('paused', 'Work is stopped. Open Earthworks and choose Resume work.');
  const permission = earthworkPermissionReason(w, p.id, pad);
  if (permission) return result('permission', permission);
  const machine = earthworkMachineBlock(w, p);
  if (machine) return result(machine.phase, machine.message);
  if (!within(pad, p))
    return result(
      'travel',
      'Drive inside the solid work boundary. The dashed shoulder blends into the surrounding ground.',
    );
  const r = constructionRules(w.settings),
    job = pad.work!;
  if (Math.abs(p.speed) > r.earthworksWorkingSpeed + 1e-6)
    return result(
      'speed',
      `Slow down to ${r.earthworksWorkingSpeed} m/s (${(r.earthworksWorkingSpeed * 2.237).toFixed(1)} mph) or less to work.`,
    );
  if (Math.abs(p.y - terrainHeight(w, p.x, p.z)) > r.earthworksTolerance)
    return result('ground', 'Bring the machine down onto the ground before working.');
  const fraction = job.fill > 0 ? Math.min(1, (job.cut + job.delivered) / job.fill) : 1;
  if (fraction < 1 && job.done >= job.volume * fraction - 1e-8)
    return result(
      'fill',
      `Deliver ${Math.ceil((job.fill - job.cut - job.delivered) / r.earthworksFillVolume)} Topsoil or Gravel in Earthworks to continue. Cut ground is reused first.`,
    );
  const cargo = p.vehicle === BULLDOZER ? job.spoil : (p.earthmovingCargo?.[p.vehicle] ?? {}),
    capacity = p.vehicle === BULLDOZER ? r.earthworksHeapCapacity : r.earthworksBucketCapacity;
  if (job.cut > job.fill && stockWeight(w, cargo) + worldItems(w)[job.material].weight > capacity)
    return result(
      'storage',
      p.vehicle === BULLDOZER
        ? 'The site heap is full. Collect spoil into your inventory or tipping trailer in Earthworks.'
        : 'The bucket is full. Open Earthworks and unload it into the site heap or a tipping trailer.',
    );
  return result(
    Math.abs(p.speed) > 0 ? 'working' : 'ready',
    `${r.earthworksSpeedAssist ? 'Work-speed assist is on. ' : ''}Drive back and forth inside the solid boundary at up to ${r.earthworksWorkingSpeed} m/s (${(r.earthworksWorkingSpeed * 2.237).toFixed(1)} mph). Keep the implement down; standing still does no work.`,
  );
}
/** The same speed assistance runs on server movement and local prediction. */
export function earthworkSpeedLimit(w: World, p: Player) {
  if (!isEarthmover(p.vehicle) || !p.earthmovingImplement) return Infinity;
  const r = constructionRules(w.settings);
  if (!r.earthworksSpeedAssist) return Infinity;
  return w.earthworks?.some(
    (e) =>
      e.work?.active &&
      !e.work.pendingApproval &&
      e.progress < 1 &&
      permitted(p, e) &&
      earthworkOperatorAllowed(e, p.id) &&
      within(e, p),
  )
    ? r.earthworksWorkingSpeed
    : Infinity;
}
function earthworkMachineBlock(w: World, p: Player) {
  const licence = helmBlock(w, p.vehicle, p.skills);
  if (licence) return { phase: 'licence', message: licence };
  if (p.fuel <= 0)
    return {
      phase: 'fuel',
      message: 'Out of fuel. Carry Fuel, open Inventory, and choose Refuel.',
    };
  if (!p.engine) return { phase: 'engine', message: 'Start the engine to work.' };
  if (!p.earthmovingImplement)
    return {
      phase: 'implement',
      message: 'Lower the implement, then drive slowly inside the solid work boundary.',
    };
}
/** Shared proximity check keeps the preview and authoritative confirmation in agreement. */
export function earthworkSurveyReach(
  w: World,
  p: Pick<Player, 'x' | 'z'>,
  input: Pick<EarthworkInput, 'x' | 'z'>,
) {
  const distance = Math.hypot(input.x - p.x, input.z - p.z),
    reach = constructionRules(w.settings).constructionPlacementReach;
  return { distance, reach, allowed: distance <= reach };
}
/** The move call supplies actual collision-resolved travel. Prediction never writes shared pads. */
export function workEarthwork(
  w: World,
  p: Player,
  from: { x: number; z: number },
  dt: number,
  prediction = false,
) {
  if (
    prediction ||
    !isEarthmover(p.vehicle) ||
    earthworkMachineBlock(w, p) ||
    p.task ||
    p.game ||
    p.hitch ||
    p.atHome ||
    p.inside
  )
    return;
  const r = constructionRules(w.settings),
    distance = Math.hypot(p.x - from.x, p.z - from.z);
  if (
    dt <= 0 ||
    !Number.isFinite(dt) ||
    distance <= 0 ||
    distance / dt > r.earthworksWorkingSpeed + 1e-6 ||
    Math.abs(p.speed) > r.earthworksWorkingSpeed + 1e-6 ||
    Math.abs(p.y - terrainHeight(w, p.x, p.z)) > r.earthworksTolerance
  )
    return;
  const pad = w.earthworks?.find(
    (e) =>
      e.work?.active &&
      !e.work.pendingApproval &&
      e.progress < 1 &&
      permitted(p, e) &&
      earthworkOperatorAllowed(e, p.id) &&
      within(e, p) &&
      within(e, from),
  );
  if (!pad) return;
  if (earthworkPermissionReason(w, p.id, pad)) return;
  const job = pad.work!,
    perMetre = p.vehicle === BULLDOZER ? r.earthworksDozerVolume : r.earthworksBackhoeVolume;
  const condition = Math.max(0, Math.min(1, p.health / maximumHealth(p, w)));
  const requested = ((distance * perMetre) / job.effort) * condition;
  const fraction = job.fill > 0 ? Math.min(1, (job.cut + job.delivered) / job.fill) : 1;
  let done = Math.min(job.volume * fraction, job.done + requested);
  if (job.volume - done < 1e-8) done = job.volume;
  if (done <= job.done) return;
  const netCut = Math.max(0, job.cut - job.fill),
    g = gatheringRules(w.settings);
  const seconds = job.seconds + dt;
  // Bound saleable output both by physical surplus and by the configured quarry rate.
  const available = Math.min(
    netCut * (done / job.volume) * r.earthworksSpoilConversion,
    ((seconds * g.gatheringSkilledYield) / g.gatheringSkilledSeconds) *
      r.earthworksQuarryYieldShare,
  );
  const generated = Math.max(0, Math.floor(available + 1e-9) - job.spoilProduced);
  const cargo = p.vehicle === BULLDOZER ? job.spoil : (p.earthmovingCargo?.[p.vehicle] ?? {});
  const capacity = p.vehicle === BULLDOZER ? r.earthworksHeapCapacity : r.earthworksBucketCapacity;
  if (stockWeight(w, cargo) + generated * worldItems(w)[job.material].weight > capacity) return;
  if (generated) {
    cargo[job.material] = (cargo[job.material] ?? 0) + generated;
    if (p.vehicle !== BULLDOZER) {
      p.earthmovingCargo ??= {};
      p.earthmovingCargo[p.vehicle] = cargo;
    }
  }
  creditEarthwork(w, pad, p, done - job.done);
  job.done = done;
  job.seconds = seconds;
  job.spoilProduced += generated;
  if (done >= job.volume - 1e-8 || w.time - job.published >= r.earthworksPublishSeconds) {
    const progress = Math.min(1, done / job.volume);
    if (progress === 1) settleEarthwork(w, pad);
    replace(w, { ...pad, progress, work: { ...job, active: progress < 1, published: w.time } });
  }
}
export function weatherEarthworks(w: World, seconds: number) {
  if (!w.earthworks?.length || w.settings.dayLength <= 0) return;
  const days = seconds / w.settings.dayLength,
    r = constructionRules(w.settings);
  let changed = false;
  const pads = w.earthworks.map((pad) => {
    if (pad.progress !== 1 || pad.finish === 'grass' || !pad.work) return pad;
    pad.work.weatherDays += days;
    if (pad.work.weatherDays + 1e-9 < r.earthworksGrassDays) return pad;
    changed = true;
    return { ...pad, finish: 'grass' as const };
  });
  if (changed) w.earthworks = pads;
}

/** Visual hint follows recent server work; a stopped/full/abandoned job stops making dust. */
export function earthworkDust(w: World, p: Player) {
  if (!isEarthmover(p.vehicle)) return false;
  const r = constructionRules(w.settings);
  return (
    isEarthmover(p.vehicle) &&
    !!p.earthmovingImplement &&
    p.engine &&
    Math.abs(p.speed) > 0.01 &&
    Math.abs(p.speed) <= r.earthworksWorkingSpeed &&
    !!w.earthworks?.some(
      (pad) =>
        pad.work?.active &&
        pad.work.done > 0 &&
        w.time - pad.work.published <= r.earthworksPublishSeconds &&
        within(pad, p),
    )
  );
}
