// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Action } from './types';
import type { Earthwork } from './earthworks-ground';
import { constructionRules } from './construction-rules';
import { economyRules } from './economy-rules';
import { governingTown, payTown } from './civics';
import { townRefusal } from './town-charter';
import { BULLDOZER, BACKHOE } from './earthmoving-definitions';
import { helmBlock } from './captain';
import { earthworkSiteReason } from './earthworks-site';
import { log } from './simulation';

export interface EarthworkContract {
  fee: number;
  fillBy: 'client' | 'operator';
  state: 'offered' | 'accepted' | 'complete' | 'cancelled';
  operator?: string;
  escrow: number;
  tax: number;
  town?: string;
  contributions: Record<string, number>;
  payouts: Record<string, number>;
}
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
export function earthworkContracts(w: World) {
  return (w.earthworks ?? []).filter((p) => p.work?.contract);
}
export function newEarthworkOffer(w: World, fee: number, fillBy: unknown): EarthworkContract {
  need(
    constructionRules(w.settings).earthworksContracts,
    'Earthworks contracts are disabled in this world',
  );
  need(
    Number.isSafeInteger(fee) && fee >= 0 && fee <= economyRules(w.settings).cashTransferLimit,
    'Choose a fee within the world cash-transfer limit',
  );
  need(fillBy === 'client' || fillBy === 'operator', 'Choose who supplies fill');
  return {
    fee,
    fillBy: fillBy === 'operator' ? 'operator' : 'client',
    state: 'offered',
    escrow: 0,
    tax: 0,
    contributions: {},
    payouts: {},
  };
}
export function earthworkPermissionReason(w: World, owner: string, site: { x: number; z: number }) {
  try {
    const town = governingTown(w, site.x, site.z);
    return (
      townRefusal(w, owner, site.x, site.z, 'build', town) ??
      townRefusal(w, owner, site.x, site.z, 'earthworks', town)
    );
  } catch (e) {
    return (e as Error).message;
  }
}
/** Physical buildings/yards remain excluded. Their surrounding construction
 * clearance needs explicit consent, including every affected property owner. */
export function earthworkPropertyOwners(w: World, pad: Earthwork) {
  const c = Math.cos(pad.rotation),
    s = Math.sin(pad.rotation),
    clearance = constructionRules(w.settings).constructionMinimumSpacing;
  return [
    ...new Set(
      w.buildings
        .filter((b) => {
          if (!b.owner || b.government || b.owner === pad.owner) return false;
          const dx = b.x - pad.x,
            dz = b.z - pad.z;
          return (
            Math.hypot(
              Math.max(0, Math.abs(dx * c - dz * s) - pad.width / 2 - pad.shoulder),
              Math.max(0, Math.abs(dx * s + dz * c) - pad.depth / 2 - pad.shoulder),
            ) < clearance
          );
        })
        .map((b) => b.owner!),
    ),
  ];
}
export function approveEarthwork(w: World, p: Player, pad: Earthwork) {
  const job = pad.work!,
    owners = earthworkPropertyOwners(w, pad);
  need(
    job.pendingApproval && (owners.includes(p.id) || (!owners.length && p.id === pad.owner)),
    'Only a required property owner may approve this survey',
  );
  const reason = earthworkPermissionReason(w, pad.owner, pad) ?? earthworkSiteReason(w, pad);
  need(!reason, reason ?? 'The site is no longer available');
  const approved = [...new Set([...(job.approvedBy ?? []), p.id])].filter((id) =>
    owners.includes(id),
  );
  const pending = owners.some((id) => !approved.includes(id));
  w.earthworks = w.earthworks!.map((e) =>
    e.id !== pad.id
      ? e
      : {
          ...pad,
          progress: !pending && job.volume === 0 ? 1 : pad.progress,
          work: {
            ...job,
            approvalOwners: owners,
            approvedBy: approved,
            pendingApproval: pending,
            active: !pending && job.volume > 0,
          },
        },
  );
  return pending
    ? 'Permission recorded; other property owners must still confirm.'
    : 'Property permission confirmed; the site is reserved.';
}
export function withdrawEarthworkSurvey(w: World, p: Player, pad: Earthwork) {
  need(
    pad.work?.pendingApproval &&
      (p.id === pad.owner || earthworkPropertyOwners(w, pad).includes(p.id)),
    'Only the client or affected property owner may withdraw a pending survey',
  );
  w.earthworks = w.earthworks!.filter((e) => e.id !== pad.id);
  return 'Survey withdrawn; no ground or money changed.';
}
export function cancelEarthworksOnDeath(w: World, id: string) {
  for (const pad of w.earthworks ?? []) {
    const c = pad.work?.contract;
    if (
      !c ||
      c.state === 'complete' ||
      c.state === 'cancelled' ||
      (pad.owner !== id && c.operator !== id)
    )
      continue;
    refundEarthwork(w, pad, pad.owner === id);
    pad.work!.active = false;
  }
}
export function earthworkOperatorAllowed(pad: Earthwork, id: string) {
  const c = pad.work?.contract;
  if (!c || c.state === 'cancelled' || c.state === 'complete') return true;
  return id === pad.owner || (c.state === 'accepted' && c.operator === id);
}
export function refundEarthwork(w: World, pad: Earthwork, cancel = false) {
  const c = pad.work?.contract;
  if (!c || c.state === 'complete') return;
  const held = c.escrow;
  c.escrow = 0;
  if (held && w.players[pad.owner]) w.players[pad.owner].cash += held;
  c.state = cancel ? 'cancelled' : 'offered';
  delete c.operator;
}
export function creditEarthwork(w: World, pad: Earthwork, p: Player, volume: number) {
  const c = pad.work?.contract;
  if (c?.state === 'accepted') c.contributions[p.id] = (c.contributions[p.id] ?? 0) + volume;
}
export function settleEarthwork(w: World, pad: Earthwork) {
  const c = pad.work?.contract;
  if (!c || c.state === 'complete' || c.state === 'cancelled') return;
  if (c.state === 'offered') {
    c.state = 'cancelled';
    return;
  }
  const total = Object.values(c.contributions).reduce((sum, n) => sum + n, 0),
    held = c.escrow,
    town = w.towns.find((t) => t.id === c.town);
  c.escrow = 0;
  c.state = 'complete'; // Mark before accounting: retries cannot pay twice.
  let remaining = Math.min(c.fee, held);
  const entries = Object.entries(c.contributions).filter(([, n]) => n > 0);
  entries.forEach(([id, n], i) => {
    const amount =
      i === entries.length - 1 ? remaining : Math.min(remaining, Math.floor((c.fee * n) / total));
    const recipient = w.players[id] ?? w.players[pad.owner];
    if (recipient) {
      recipient.cash += amount;
      c.payouts[recipient.id] = (c.payouts[recipient.id] ?? 0) + amount;
      if (recipient.id !== pad.owner)
        log(w, 'transfer', amount, pad.owner, recipient.id, 'earthworks contract');
    }
    remaining -= amount;
  });
  if (remaining && w.players[pad.owner]) w.players[pad.owner].cash += remaining;
  const tax = held - Math.min(c.fee, held);
  if (town) payTown(w, town, pad.owner, tax, 'earthworks construction tax');
  else if (tax && w.players[pad.owner]) w.players[pad.owner].cash += tax;
}
export function earthworkContractAction(w: World, p: Player, pad: Earthwork, a: Action) {
  const job = pad.work!,
    c = job.contract,
    rules = constructionRules(w.settings);
  if (a.operation === 'cancelOffer') {
    need(p.id === pad.owner, 'Only the client may cancel this offer');
    need(c && c.state !== 'complete', 'This contract is already complete or settled');
    refundEarthwork(w, pad, true);
    job.active = false;
    return 'Contract cancelled; escrow refunded and partial ground retained.';
  }
  need(rules.earthworksContracts, 'Earthworks contracts are disabled in this world');
  need(
    !job.pendingApproval && pad.progress < 1,
    'Confirm property permission and choose an unfinished pad',
  );
  if (a.operation === 'offer') {
    need(p.id === pad.owner, 'Only the client may post this site');
    need(
      !c || (c.state !== 'accepted' && !Object.values(c.contributions).some((n) => n > 0)),
      'Keep the agreed terms once paid work has been credited',
    );
    job.contract = newEarthworkOffer(w, Number(a.fee), a.fillBy);
    return 'Earthworks offer posted. Payment is held only when an operator accepts.';
  }
  need(
    a.operation === 'accept' && c?.state === 'offered',
    'This offer is not available or already accepted',
  );
  need(p.id !== pad.owner, 'A client cannot accept their own contract');
  need(
    (p.fleet ?? []).some((s) => s === BULLDOZER || s === BACKHOE),
    'Own an earthmoving machine first',
  );
  const block = helmBlock(w, BULLDOZER, p.skills);
  need(!block, block ?? 'Plant operator qualification required');
  const reason =
    earthworkPermissionReason(w, pad.owner, pad) ??
    earthworkPermissionReason(w, p.id, pad) ??
    earthworkSiteReason(w, pad);
  need(!reason, reason ?? 'The site is no longer available');
  const town = governingTown(w, pad.x, pad.z),
    tax = Math.round(c!.fee * (1 + (town?.tax ?? 0))) - c!.fee,
    held = c!.fee + tax,
    client = w.players[pad.owner];
  need(
    client && client.cash >= held,
    'The client needs enough cash for the fee and town construction tax',
  );
  client.cash -= held;
  Object.assign(c!, { state: 'accepted', operator: p.id, escrow: held, tax, town: town?.id });
  job.operators = [...new Set([...job.operators, p.id])];
  job.active = true;
  return 'Contract accepted; fee and town tax are held until completion.';
}
