// SPDX-License-Identifier: GPL-3.0-or-later
import type { Building, Player, World } from './types';
import { crops } from './farming';
import { DAY_SECONDS } from './environment';
export interface FarmPolicy {
  crops: string[];
  dailyLimit?: number;
  reserve: number;
}
export function validateFarmPolicy(value: unknown): FarmPolicy {
  const v = value as FarmPolicy;
  if (
    !v ||
    !Array.isArray(v.crops) ||
    v.crops.length > Object.keys(crops).length ||
    v.crops.some((c) => typeof c !== 'string' || !Object.hasOwn(crops, c)) ||
    new Set(v.crops).size !== v.crops.length ||
    !Number.isSafeInteger(v.reserve) ||
    v.reserve < 0 ||
    v.reserve > 100000000 ||
    (v.dailyLimit !== undefined &&
      (!Number.isSafeInteger(v.dailyLimit) || v.dailyLimit < 0 || v.dailyLimit > 100000000))
  )
    throw Error(
      'Choose valid staff crops, a nonnegative reserve and an optional daily cash budget',
    );
  return {
    crops: [...v.crops],
    reserve: v.reserve,
    ...(v.dailyLimit === undefined ? {} : { dailyLimit: v.dailyLimit }),
  };
}
export function farmStaffSpent(w: World, b: Building) {
  return b.farmStaffSpending?.day === Math.floor(w.time / DAY_SECONDS)
    ? b.farmStaffSpending.amount
    : 0;
}
export function farmStaffBlocker(w: World, p: Player, b: Building, cost: number, crop?: string) {
  if (p.id === b.owner || !b.farmPolicy) return;
  const policy = b.farmPolicy;
  if (crop && !policy.crops.includes(crop))
    return 'The owner has not approved this crop for staff planting';
  if (cost > 0 && b.investment - cost < policy.reserve)
    return 'This purchase would spend the farm’s protected cash reserve';
  if (
    cost > 0 &&
    policy.dailyLimit !== undefined &&
    farmStaffSpent(w, b) + cost > policy.dailyLimit
  )
    return 'The staff seed/fertilizer cash budget for this game day is exhausted';
}
export function recordFarmStaffSpending(w: World, p: Player, b: Building, amount: number) {
  if (p.id === b.owner || amount <= 0) return;
  b.farmStaffSpending = {
    day: Math.floor(w.time / DAY_SECONDS),
    amount: farmStaffSpent(w, b) + amount,
  };
}
