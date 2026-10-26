// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import { remainingClaim, ownerWithdrawable } from '../../shared/stakes.ts';
import { retainedCapital } from './business-policy.ts';
import { visitBuilding } from './care.ts';

/** Fund a named, costed project, not a speculative transfer of every spare coin.
 * requiredCash includes its household/operating reserves. Sources are current
 * owned tills only; all transfers still execute ordinary location/ownership checks. */
export function fundProject(
  w: World,
  p: Player,
  requiredCash: number,
  project: (funded: Player) => Step[],
  exclude: string[] = [],
): Step[] | undefined {
  if (!Number.isFinite(requiredCash) || requiredCash < 0) return;
  let missing = Math.max(0, Math.ceil(requiredCash - p.cash));
  let position = { ...p };
  const prefix: Step[] = [];
  const sources = w.buildings
    .filter((b) => b.owner === p.id && !b.construction && !b.government && !exclude.includes(b.id))
    .map((b) => ({
      b,
      available: Math.max(
        0,
        Math.min(ownerWithdrawable(w, b), b.investment - remainingClaim(b) - retainedCapital(w, b)),
      ),
    }))
    .sort((a, b) => b.available - a.available);
  for (const { b, available } of sources) {
    const amount = Math.min(missing, available, 10_000_000);
    if (!amount) continue;
    prefix.push(
      ...visitBuilding(position, b, [
        {
          kind: 'act',
          action: { type: 'investment', building: b.id, direction: 'withdraw', amount },
        },
      ]),
    );
    position = { ...position, x: b.x, z: b.z, atHome: false, cash: position.cash + amount };
    missing -= amount;
    if (!missing) break;
  }
  // Savings are real money too. Keep all transfers coupled to the actual project.
  if (missing && p.bank >= missing && missing <= 10_000_000) {
    const bank = w.buildings.find((b) => b.kind === 'bank' && !b.construction);
    if (bank) {
      prefix.push(
        ...visitBuilding(position, bank, [
          {
            kind: 'act',
            action: { type: 'bank', building: bank.id, direction: 'withdraw', amount: missing },
          },
        ]),
      );
      position = {
        ...position,
        x: bank.x,
        z: bank.z,
        atHome: false,
        cash: position.cash + missing,
      };
      missing = 0;
    }
  }
  if (missing) return;
  const plan = [...prefix, ...project(position)];
  return plan.length <= 12 ? plan : undefined;
}
