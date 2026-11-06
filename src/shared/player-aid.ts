import { parkedRefuelStatus, persistentVehicles } from './parked-vehicles';
import defaults from '../../data/settings.json';
import { economyRules } from './economy-rules';
import { fuelRules } from './fuel-rules';
import { worldItems } from './world-catalogue';
import { vehicleDef } from './vehicle-config';
import { fuelCapacity } from './tractors.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types.ts';
export const MAX_MONEY_GIFT = defaults.maximumMoneyGift; // Internal hundredths; 1,000,000d per gift.
export function giftAmount(text: string, w?: World) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim()))
    throw Error('Enter denarii with at most two decimal places');
  const [whole, fraction = ''] = text.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  const maximum = economyRules(w?.settings).maximumMoneyGift;
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > maximum)
    throw Error(
      `Choose a gift between 0.01d and ${(maximum / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}d`,
    );
  return amount;
}
export function moneyGiftReason(w: World, p: Player, target?: Player) {
  if (w.settings.allowMoneyGifts === false) return 'Money gifts are disabled in this world';
  if (!target || !target.online || target.id === p.id)
    return 'Choose another online player in this parish';
  if (!p.online) return 'Sign in to give money';
}
export function refuellingStatus(w: World, p: Player, target?: Player, publicSnapshot = false) {
  if (
    target &&
    target.vehicle === 5 &&
    target.id !== p.id &&
    target.online &&
    p.online &&
    persistentVehicles(w, p)
  ) {
    const parked = Object.values(w.parkedVehicles ?? {})
      .filter((v) => v.owner === target.id && !v.inside)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (parked) {
      const status = parkedRefuelStatus(w, p, target.id, parked.slot);
      return { ...status, parked };
    }
  }
  const rules = fuelRules(w.settings);
  const units = Math.max(
    0,
    Math.min(
      worldItems(w).fuel.fuel ?? 0,
      (target ? fuelCapacity(target, w) : 64) - (target?.fuel ?? 0),
    ),
  );
  let reason: string | undefined;
  if (w.settings.allowPlayerRefuelling === false)
    reason = 'Helping refuel players is disabled in this world';
  else if (!target || !target.online || target.id === p.id || !p.online)
    reason = 'Choose another online player in this parish';
  else if (p.atHome || target.atHome || p.crowBody || target.crowBody || p.hitch || target.hitch)
    reason = 'Both players must be outside and not riding as a passenger or scouting';
  else if (p.game || target.game || p.task || target.task)
    reason = 'Finish other activities before refuelling';
  else if (
    Math.hypot(p.x - target.x, p.z - target.z) >= rules.refuelRange ||
    Math.abs(p.y - target.y) > rules.refuelHeight
  )
    reason = `Move within ${rules.refuelRange} metres of the other player at the same height`;
  else if (Math.abs(p.speed) > rules.refuelSpeed || Math.abs(target.speed) > rules.refuelSpeed)
    reason = 'Both players must stop moving to refuel';
  else if (!(vehicleDef(w, target.vehicle)?.fuel > 0))
    reason = 'The other player must be in a fuel-powered vehicle';
  else if (!(publicSnapshot ? target.canReceiveFuel : refuelRecipientReady(target, w)))
    reason = 'Their vehicle is unavailable for refuelling (full tank or another activity)';
  else if (!(p.inventory.fuel > 0)) reason = 'Carry Fuel from a stocked shop or garage';
  return { units, reason, parked: undefined };
}
export function refuelRecipientReady(p: Player, w?: World) {
  return !!(
    p.online &&
    !p.atHome &&
    !p.crowBody &&
    !p.hitch &&
    !p.game &&
    !p.task &&
    Math.abs(p.speed) <= fuelRules(w?.settings).refuelSpeed &&
    vehicleDef(w, p.vehicle)?.fuel > 0 &&
    Number.isFinite(p.fuel) &&
    p.fuel < fuelCapacity(p, w)
  );
}
