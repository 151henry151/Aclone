// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building, Action, Stock } from './types';
import { meatAnimals, slaughterOutputs, rawMeats } from './meat-recipes';
import { meatRules } from './meat-rules';
import { worldItems } from './world-catalogue';
import { herdSpec, youngAnimals } from './livestock';
import { buildingPlan } from './building-shapes';
import { productionStaff } from './sound-state';
import { ownerOperating } from './staffing';
import { attachedTrailer, trailerAccepts } from './trailers';
import { canCarry, log } from './simulation';
import { economyRules } from './economy-rules';
import { addFreshMeat } from './meat-freshness';
function need(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function butcherRamp(b: Building) {
  const ramp = buildingPlan(b).waterfront![0];
  return {
    x: b.x + ramp.x * Math.cos(b.rotation) + ramp.z * Math.sin(b.rotation),
    z: b.z - ramp.x * Math.sin(b.rotation) + ramp.z * Math.cos(b.rotation),
  };
}
export function slaughterFee(w: World, b: Building, animal: string) {
  return (
    b.slaughterFees?.[animal] ??
    Math.round(worldItems(w)[animal].price * meatRules(w.settings).slaughterFeeFraction)
  );
}
export function butcherAction(
  w: World,
  p: Player,
  a: Action,
  quote?: { fee: number; outputs: Stock },
  at = w.time,
) {
  if (a.operation === 'cancel') {
    need(p.task?.kind === 'slaughter', 'No slaughter service is in progress');
    delete p.task;
    return 'Slaughter cancelled. Your animal and cash remain yours.';
  }
  const b = w.buildings.find((b) => b.id === a.building),
    rules = meatRules(w.settings);
  need(b?.kind === 'butcher' && !b.construction, 'Choose a completed butcher');
  const ramp = butcherRamp(b);
  need(
    !p.atHome &&
      !p.hitch &&
      !p.game &&
      !p.crowBody &&
      !p.task &&
      Math.abs(p.speed) <= rules.slaughterStoppedSpeed &&
      Math.hypot(p.x - ramp.x, p.z - ramp.z) <= rules.slaughterRange,
    'Stop alongside the butcher loading ramp and finish your other activity',
  );
  if (a.operation === 'fee' || a.operation === 'menu') {
    need(b.owner === p.id, 'Only the butcher owner can change fees or the counter menu');
    const animal = String(a.item);
    need(Object.hasOwn(meatAnimals, animal), 'Choose an adult animal');
    if (a.operation === 'fee') {
      need(
        typeof a.fee === 'number' &&
          Number.isSafeInteger(a.fee) &&
          a.fee >= 0 &&
          a.fee <= 100000000,
        'Choose a non-negative whole fee',
      );
      b.slaughterFees = { ...b.slaughterFees, [animal]: a.fee };
      return 'Slaughter fee updated.';
    }
    need(!b.production, 'This butcher has a custom world recipe');
    b.recipe = `butcher_${animal}`;
    b.progress = 0;
    return `Counter menu: ${worldItems(w)[animal].name} to ${worldItems(w)[meatAnimals[animal as keyof typeof meatAnimals].raw].name}.`;
  }
  need(a.operation === 'slaughter', 'Unknown butcher service');
  need(rules.butchersEnabled, 'Butchers are disabled in this world');
  const item = String(a.item),
    n = Number(a.quantity);
  need(
    Number.isSafeInteger(n) && n > 0 && n <= economyRules(w.settings).transactionItemLimit,
    'Choose a positive whole animal quantity',
  );
  need(
    a.storage === undefined || a.storage === 'trailer',
    'Choose your inventory or livestock wagon',
  );
  const trailer =
    a.storage === 'trailer'
      ? a.trailer
        ? w.trailers?.[String(a.trailer)]
        : attachedTrailer(w, p)
      : undefined;
  if (a.storage === 'trailer')
    need(
      trailer &&
        trailer.owner === p.id &&
        trailer.kind === 'livestock' &&
        (!trailer.attached || trailer.attached === p.id) &&
        Math.hypot(trailer.x - ramp.x, trailer.z - ramp.z) <= rules.slaughterRange,
      'Stop your livestock wagon alongside the loading ramp',
    );
  const source = trailer ? trailer.cargo : p.inventory,
    life = trailer ? trailer.life : p.inventoryLife;
  need((source[item] ?? 0) >= n, 'Not enough animals in the selected cargo');
  if (youngAnimals[item]) {
    const spec = herdSpec({ kind: meatAnimals[youngAnimals[item]].farm }, w.settings)!;
    const cohorts = life?.young?.filter((c) => c.item === item) ?? [];
    const grown = cohorts.length ? Math.min(...cohorts.map((c) => c.grownDays)) : 0;
    throw Error(
      `Young animals cannot be slaughtered: ${Math.max(0, spec.maturityDays - grown).toFixed(1)} days to maturity with healthy farm care.`,
    );
  }
  need(Object.hasOwn(meatAnimals, item), 'Choose an adult cow, pig, sheep or chicken');
  need(
    trailer ||
      (p.vehicle === 5 && n === 1 && worldItems(w)[item].weight <= rules.slaughterWalkingWeight),
    'Use a livestock wagon, or walk one small animal to the ramp',
  );
  const staff = productionStaff(w, b, w.time);
  const workingOwner = ownerOperating(w, b) && b.owner ? w.players[b.owner] : undefined;
  need(
    [...staff, ...(workingOwner ? [workingOwner] : [])].some((p) => p.skills.includes('butcher')),
    'Employ a qualified butcher or operate the business with that skill',
  );
  const fee = slaughterFee(w, b, item) * n;
  need(Number.isSafeInteger(fee) && p.cash >= fee, 'Not enough cash for the slaughter fee');
  const outputs = Object.fromEntries(
    Object.entries(slaughterOutputs(item as keyof typeof meatAnimals, w.settings)).map(
      ([id, amount]) => [id, amount * n],
    ),
  );
  need(
    !quote || (quote.fee === fee && JSON.stringify(quote.outputs) === JSON.stringify(outputs)),
    'The slaughter fee or yields changed; review the service again',
  );
  const next = { ...source, [item]: source[item] - n };
  for (const [id, amount] of Object.entries(outputs)) next[id] = (next[id] ?? 0) + amount;
  need(
    trailer
      ? Object.keys(outputs).every((id) => trailerAccepts(w, { ...trailer, cargo: next }, id, 0))
      : canCarry({ ...p, inventory: next }, item, 0, w),
    'Make room for the meat and by-products before slaughter',
  );
  if (!quote) {
    p.task = {
      kind: 'slaughter',
      end: w.time + rules.slaughterSeconds * n,
      building: b.id,
      item,
      amount: n,
      slaughter: { action: { ...a, ...(trailer ? { trailer: trailer.id } : {}) }, fee, outputs },
    };
    return `Slaughter arranged for ${n} ${worldItems(w)[item].name}; ${rules.slaughterSeconds * n} seconds. The animal and fee transfer only on completion.`;
  }
  source[item] -= n;
  if (!source[item]) delete source[item];
  for (const [id, amount] of Object.entries(outputs)) addFreshMeat(w, source, id, amount, at);
  p.cash -= fee;
  b.investment += fee;
  log(w, 'transfer', fee, p.id, b.id, 'slaughter service');
  return `Slaughter complete: ${Object.entries(outputs)
    .map(([id, n]) => `${n} ${worldItems(w)[id].name}`)
    .join(', ')} returned to your ${trailer ? 'wagon' : 'inventory'}.`;
}
