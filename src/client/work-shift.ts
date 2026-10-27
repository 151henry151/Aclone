// SPDX-License-Identifier: GPL-3.0-or-later
import { recipes } from '../shared/catalog';
import type { World, Player, Building } from '../shared/types';
import { productionInterval } from '../shared/simulation';

const duration = (n: number) => `${Math.floor(n / 60)}m ${n % 60}s`;
/** Presentation of the saved shift; starting a shift is not a completed batch. */
export function workShift(w: World, p: Player, b: Building) {
  if (b.construction) return;
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  const owner =
    b.owner === p.id &&
    w.settings.ownerOperation &&
    b.kind !== 'farm' &&
    !!recipe &&
    p.skills.includes(recipe.skill);
  const employee =
    (b.kind === 'lighthouse' || b.owner !== p.id) &&
    p.job === b.id &&
    w.settings.jobsEnabled !== false;
  if (!(b.recipe || b.production || b.kind === 'lighthouse') || (!owner && !employee)) return;
  const interval = productionInterval(w, b);
  const until = owner ? (b.ownerActiveUntil ?? 0) : p.activeUntil;
  const remaining = Math.max(0, Math.ceil(until - w.time));
  const continuous = !w.settings.activeWork;
  const active = continuous || remaining > 0;
  const nextIn = Math.ceil((Math.floor(w.time / interval) + 1) * interval - w.time);
  const checks =
    b.kind === 'farm'
      ? undefined
      : continuous
        ? undefined
        : Math.max(0, Math.floor(until / interval) - Math.floor(w.time / interval));
  const label = continuous
    ? `${owner ? 'Operating' : 'Employed'} · No renewal needed`
    : active
      ? `Shift active · ${duration(remaining)} left`
      : 'Shift ended · Renew to work again';
  const detail =
    b.kind === 'lighthouse'
      ? `Next keeper payment in ${duration(nextIn)}. The navigation service funds this wage; your private quarters remain available while employed.`
      : b.kind === 'farm'
        ? 'Farm pay comes from completing funded harvest tasks, not automatic production checks.'
        : `${checks === undefined ? '' : `${checks} production check${checks === 1 ? '' : 's'} covered. `}Next check in ${duration(nextIn)}. ${owner ? 'Operate without wages' : 'Wages require successful production'}; staffing efficiency may require several checks per batch; inputs, space and funding are still needed. You may drive away; the shift keeps running, even offline.`;
  return {
    label,
    detail,
    remaining,
    nextIn,
    checks,
    active,
    canRenew: !continuous && remaining <= interval,
    button: continuous
      ? 'No renewal needed'
      : active
        ? remaining <= interval
          ? 'Renew for two cycles'
          : `Working · ${duration(remaining)} left`
        : owner
          ? 'Operate without wages'
          : b.kind === 'farm'
            ? 'Refresh farm shift'
            : 'Work two cycles',
  };
}
