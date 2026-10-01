// SPDX-License-Identifier: GPL-3.0-or-later
import type { FarmerChoice } from './farmer.ts';
import type { Preference } from './population.ts';
/** Soft guidance only: every legal choice remains available, and Jev still decides. */
export function preferChoices(choices: FarmerChoice[], preference: Preference, job?: string) {
  return choices.map((choice) => {
    const actions = choice.plan.flatMap((s) => (s.kind === 'act' ? [s.action] : []));
    const operations = choice.plan.flatMap((s) => (s.kind === 'operation' ? [s.operation] : []));
    const preferred =
      preference === 'trader'
        ? actions.some((a) => a.type === 'trade' && a.direction === 'sell')
        : preference === 'gatherer'
          ? actions.some((a) => a.type === 'gather') || choice.plan.some((s) => s.kind === 'fish')
          : preference === 'owner'
            ? actions.some((a) => ['buyBuilding', 'investment', 'stock'].includes(a.type)) ||
              operations.some((o) => ['construct', 'buildingAdmin', 'supply', 'repair'].includes(o))
            : preference === 'employee'
              ? actions.some((a) => ['job', 'work', 'learn'].includes(a.type)) ||
                (!!job && choice.description.startsWith('Keep my active job'))
              : preference === 'farmer'
                ? actions.some(
                    (a) => a.type === 'farm' || (a.type === 'learn' && a.skill === 'farmer'),
                  )
                : false;
    return preferred
      ? {
          ...choice,
          description: `[Fits my ${preference} inclination; compare actual costs and results.] ${choice.description}`,
        }
      : choice;
  });
}
