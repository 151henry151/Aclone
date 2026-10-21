// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { ResidentState } from './memory.ts';
import { businessEconomics, ECONOMICS_ASSUMPTIONS } from '../../shared/business-economics.ts';
import { cashFlow } from '../../shared/reports.ts';

/** Explicit owner scope; only read accounts already allowed by perceivedWorld. */
export function portfolioBriefing(w: World, p: Player, state: ResidentState, omniscient = false) {
  const question = (state.helpQuestion ?? '').toLowerCase();
  if (!/profit|margin|business|loss|losing|payroll|wage|staff|quarry|mill|bakery/.test(question))
    return undefined;
  const owners = new Map<string, string>();
  for (const b of w.buildings)
    if (b.owner) owners.set(b.owner, b.ownerName ?? w.players[b.owner]?.name ?? b.owner);
  const named = [...owners].filter(
    ([id, name]) => id !== p.id && question.includes(name.toLowerCase()),
  );
  const ids = new Set(named.map(([id]) => id));
  if (/\bmy\b/.test(question) && state.questionFrom) ids.add(state.questionFrom);
  if (!ids.size && /\byour\b/.test(question)) ids.add(p.id);
  if (!ids.size) return undefined;
  const denarii = (n: number) => Math.round(n) / 100;
  return {
    scope: omniscient
      ? 'Current public ownership and quotes; private accounts of other owners are unavailable.'
      : 'Only businesses I have inspected or own; not a complete live portfolio.',
    estimateAssumptions: ECONOMICS_ASSUMPTIONS,
    owners: [...ids].map((id) => ({ id, name: owners.get(id) ?? id })),
    businesses: w.buildings
      .filter((b) => b.owner && ids.has(b.owner) && b.kind !== 'home')
      .slice(0, 30)
      .map((b) => {
        const e = businessEconomics(w, b);
        return {
          id: b.id,
          name: b.name,
          ownerId: b.owner,
          ownerName: owners.get(b.owner!),
          estimate: e
            ? {
                paidWorkers: e.current.paidWorkers,
                unpaidOwner: e.current.ownerOperating,
                idealTotalCrew: e.ideal,
                efficiencyPercent: e.current.efficiency * 100,
                receiptsPerBatchDenarii: denarii(e.revenue),
                inputsPerBatchDenarii: denarii(e.inputs),
                payrollPerBatchDenarii: denarii(e.current.payroll),
                marginPerBatchDenarii: denarii(e.current.margin),
                potentialPerRealHourDenarii: e.hourlyReliable
                  ? denarii(e.current.profitPerHour)
                  : null,
                caveat: e.caveat,
              }
            : null,
          recordedOperatingCashFlowDenarii: b.accounts ? denarii(cashFlow(b.accounts)) : null,
          recordedSinceWorldTime: b.accounts?.since ?? null,
          note: b.kind === 'farm' ? 'Harvest-based wages; no factory batch estimate.' : null,
        };
      }),
    responseRule:
      'Only attribute the listed properties to these exact owners. These are estimated margins, not observed profit. Missing private cash flow means unknown, not zero. Quote labelled Denarii values without dividing again. Give a short complete answer about at most three significant businesses and offer the remainder; never dump the whole report or cut a sentence to fit. Direct owners to Statement for their private cash-flow history.',
  };
}
