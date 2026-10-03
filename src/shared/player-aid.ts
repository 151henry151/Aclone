// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from './types.ts';
import { items, vehicles } from './catalog.ts';
export const MAX_MONEY_GIFT = 100000000; // Internal hundredths; 1,000,000d per gift.
export function giftAmount(text: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(text.trim()))
    throw Error('Enter denarii with at most two decimal places');
  const [whole, fraction = ''] = text.trim().split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_MONEY_GIFT)
    throw Error('Choose a gift between 0.01d and 1,000,000d');
  return amount;
}
export function moneyGiftReason(w: World, p: Player, target?: Player) {
  if (w.settings.allowMoneyGifts === false) return 'Money gifts are disabled in this world';
  if (!target || !target.online || target.id === p.id)
    return 'Choose another online player in this parish';
  if (!p.online) return 'Sign in to give money';
}
export function refuellingStatus(w: World, p: Player, target?: Player, publicSnapshot = false) {
  const units = Math.max(0, Math.min(items.fuel.fuel ?? 8, 64 - (target?.fuel ?? 0)));
  let reason: string | undefined;
  if (w.settings.allowPlayerRefuelling === false)
    reason = 'Helping refuel players is disabled in this world';
  else if (!target || !target.online || target.id === p.id || !p.online)
    reason = 'Choose another online player in this parish';
  else if (p.atHome || target.atHome || p.crowBody || target.crowBody || p.hitch || target.hitch)
    reason = 'Both players must be outside and not riding as a passenger or scouting';
  else if (p.game || target.game || p.task || target.task)
    reason = 'Finish other activities before refuelling';
  else if (Math.hypot(p.x - target.x, p.z - target.z) >= 15 || Math.abs(p.y - target.y) > 3)
    reason = 'Move within 15 metres of the other player at the same height';
  else if (Math.abs(p.speed) > 0.5 || Math.abs(target.speed) > 0.5)
    reason = 'Both players must stop moving to refuel';
  else if (!(vehicles[target.vehicle]?.fuel > 0))
    reason = 'The other player must be in a fuel-powered vehicle';
  else if (!(publicSnapshot ? target.canReceiveFuel : refuelRecipientReady(target)))
    reason = 'Their vehicle is unavailable for refuelling (full tank or another activity)';
  else if (!(p.inventory.fuel > 0)) reason = 'Carry Fuel from a stocked shop or garage';
  return { units, reason };
}
export function refuelRecipientReady(p: Player) {
  return !!(
    p.online &&
    !p.atHome &&
    !p.crowBody &&
    !p.hitch &&
    !p.game &&
    !p.task &&
    Math.abs(p.speed) <= 0.5 &&
    vehicles[p.vehicle]?.fuel > 0 &&
    Number.isFinite(p.fuel) &&
    p.fuel < 64
  );
}
