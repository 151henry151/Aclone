import { creditRules } from './credit-rules';
import { loanRules } from './loan-rules';
import { economyRules } from './economy-rules';
import { survivalRules } from './survival-rules';
import { radioRules } from './radio-rules';
import { fuelRules } from './fuel-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import type { Settings, World } from './types.ts';
import { flightRules, landingLimits } from './flight-rules';
import { walkingRules } from './walking-rules';
import { gatheringSceneryRules } from './gathering-scenery';
export const rulesets: Record<
  string,
  { name: string; description: string; settings: Partial<Settings> }
> = {
  relaxed: {
    name: 'Relaxed owner economy',
    description:
      'No hunger or thirst; owners operate qualified businesses without taking wages. Jobs are disabled.',
    settings: {
      hungerRate: 0,
      thirstRate: 0,
      jobsEnabled: false,
      ownerOperation: true,
      activeWork: false,
      maxBuildings: 25,
      maxSkills: 12,
      loseSkillsOnDeath: false,
      losePropertyOnDeath: false,
      loseInventoryOnDeath: false,
    },
  },
  survival: {
    name: 'Harsh survival village',
    description:
      'Faster needs, no unattended production, loss of skills and property on death; one hour of needs grace after rebirth.',
    settings: { hungerRate: 3.6, thirstRate: 5, offlineEfficiency: 0, postDeathGraceSeconds: 3600 },
  },
  civilization: {
    name: 'Civilization frontier',
    description:
      'Build an industrial settlement with owner operation, employment and combat. Local combat rules still protect safe zones.',
    settings: {
      fighting: true,
      ownerOperation: true,
      maxBuildings: 12,
      maxSkills: 8,
      retainEstateContents: true,
      estateEquityShare: 0.9,
    },
  },
};
export function rulesSummary(w: Pick<World, 'settings'>): string {
  const s = w.settings;
  const survival = survivalRules(s),
    credit = creditRules(s);
  const fuel = fuelRules(s);
  const radio = radioRules(s),
    loans = loanRules(s);
  const walking = walkingRules(s);
  const gathering = gatheringSceneryRules(s);
  const flight = flightRules(s),
    limits = landingLimits(s);
  return [
    `Credit score: ${credit.creditScoreMinimum}–${credit.creditScoreMaximum}, starting ${credit.creditScoreInitial}; history ${credit.creditHistoryMonthlyPoints}/month up to ${credit.creditHistoryMaximum}, on-time ${credit.creditOnTimePoints} each up to ${credit.creditOnTimeMaximum}, employment up to ${credit.creditEmploymentPoints}, assets per point ${credit.creditAssetUnit} hundredths up to ${credit.creditAssetMaximum}; late/default ${credit.creditLatePoints}/${credit.creditDefaultPoints} capped at ${credit.creditPenaltyMaximum}; debt ratio ×${credit.creditDebtPoints} capped at ${credit.creditDebtMaximum}, denominator floor ${credit.creditDebtDenominatorMinimum} hundredths.`,
    `Loans: ${loans.loanTerms} months; ${loans.loanMaximumActive} active; ${loans.loanMortgageLtv * 100}% structural LTV. Personal/mortgage base APR ${loans.loanPersonalBaseApr}/${loans.loanMortgageBaseApr}%, spreads ${loans.loanPersonalAprSpread}/${loans.loanMortgageAprSpread} points per ${loans.loanRateScoreSpan} score points below ${credit.creditScoreMaximum}; minimum scores ${loans.loanPersonalMinimumScore}/${loans.loanMortgageMinimumScore}. Existing loans keep signed terms.`,
    `Economy: minimum purchase bid ${economyRules(s).minimumBuyPrice} hundredths; up to ${economyRules(s).transactionItemLimit} items per transaction. New outside deposits earn up to ${economyRules(s).outsideReturnPercent}% above principal; operating reserve floor ${economyRules(s).outsideOperatingReserve} hundredths.`,
    `Government imports: ${economyRules(s).governmentImportPremium}% premium; water/bread/fuel floors ${economyRules(s).governmentWaterFloor}/${economyRules(s).governmentBreadFloor}/${economyRules(s).governmentFuelFloor}; public bid margin ${economyRules(s).governmentImportBidMargin} hundredths.`,
    `Public export interval: ${economyRules(s).exportShipmentInterval} seconds (Puddlewick economy terminals only).`,
    `Supply orders: ${economyRules(s).parishOrderPeriod}-second rounds; ${economyRules(s).parishOrderShare * 100}% per supplier for the first ${economyRules(s).parishOrderShareWindow * 100}% of each new round. Funded rounds keep posted terms.`,
    `Transfers: gift maximum ${economyRules(s).maximumMoneyGift}; bank/investment maximum ${economyRules(s).cashTransferLimit} hundredths per transfer.`,
    `Lighthouse keeper wage cap: ${economyRules(s).lighthouseWageCap} hundredths per game day; posted wages and ordinary factory pay remain separate.`,
    `Services: ${economyRules(s).vehicleServiceSteel} Steel and ${economyRules(s).vehicleServiceFee} hundredths labour; map ${economyRules(s).mapPrintPrice}; ammunition ${economyRules(s).ammunitionRefitPrice} hundredths.`,
    `Survival: automatic meals at ${survival.needsAutoFeedThreshold}, damage at ${survival.needsDamageThreshold}; base maximum health ${survival.baseMaximumHealth}, nutrition adjustment ±${survival.nutritionAdjustmentLimit}. Repeated manual servings use ${survival.repeatServingMultiplier}× food/drink from serving ${survival.repeatServingFrom}; online energy regenerates ${survival.energyRegeneration}/s.`,
    `School: first tuition ${survival.schoolFirstPrice}, ${survival.schoolFirstSeconds} seconds; later ${survival.schoolLaterPrice}, ${survival.schoolLaterSeconds} seconds. Licences ${survival.licencesCountSkills ? 'count' : 'do not count'} against the skill limit. Odd Jobs: ${survival.labourShiftSeconds}-second shifts; relief ${survival.labourReliefPay} below ${survival.labourReliefMeans} cash plus bank, every ${survival.labourReliefCooldown} seconds.`,
    `CB radios ${radio.radioEnabled ? 'on' : 'off'}; ${radio.radioChannelCount} channels; ground range ${radio.radioRange} m; speech ${radio.radioCharsPerSecond} characters/s; chat moderation ${radio.radioModeration ? 'on' : 'off'}; resident radio use ${radio.radioResidents ? 'on' : 'off'}.`,
    `Roadside tanker sales ${fuel.fuelTankerSales ? 'on' : 'off'}; offline sales ${fuel.fuelTankerOfflineSales ? 'on' : 'off'}; limit ${fuel.fuelTankerTransactionLimit} Fuel; shop ceiling ${fuel.fuelTankerPriceCeiling || 'off'}; resident purchases ${fuel.fuelTankerNpcPurchasing ? 'on' : 'off'} at up to ${fuel.fuelTankerNpcPriceFactor}× shop price. Refuelling: ${fuel.refuelRange} m range, ${fuel.refuelHeight} m height, ${fuel.refuelSpeed} m/s speed; ${fuel.fuelUnitsPerItem} tank units per Fuel.`,
    s.hungerRate || s.thirstRate
      ? `Needs continue offline (hunger ${s.hungerRate}/s, thirst ${s.thirstRate}/s). Odd Jobs pays ${s.labourShiftPay ?? 100} per ${survival.labourShiftSeconds}-second shift, up to ${s.labourDailyCap ?? 20000} a game day. ${s.autoConsumeInventory ? `Inventory food and drink are consumed automatically ${s.autoConsumeInventoryOnline === false ? 'while signed off' : 'online and offline'}.` : 'Inventory eating is manual.'} ${s.autoConsumeAlcohol ? 'Automatic meals may include beer and wine.' : 'Beer and wine are never consumed automatically.'} ${s.autoConsumeHomeStock ? 'Your selected home supplies also feed you while away.' : 'Home stores feed you only while inside.'} At home, needs drain at ${Math.round((s.homeNeedsMultiplier ?? 0.8) * 100)}% of normal.`
      : 'Hunger and thirst are disabled.',
    s.jobsEnabled === false
      ? 'Paid jobs are disabled.'
      : `Paid jobs enabled; ${s.activeWork ? 'renew active shifts' : 'unattended employment allowed'}.`,
    s.ownerOperation
      ? 'Qualified owners can operate their own businesses without wages.'
      : 'Owners cannot employ themselves.',
    `Death: ${s.loseSkillsOnDeath ? 'lose' : 'keep'} skills, ${s.loseInventoryOnDeath ? 'lose' : 'keep'} inventory, ${s.losePropertyOnDeath ? 'release' : 'keep'} property; retain ${Math.round(s.deathCashRetention * 100)}% cash and ${Math.round(s.deathBankRetention * 100)}% savings.`,
    `Walking snow: ${walking.walkingSnow ? `enabled, field strength ${walking.walkingSnowScale}` : 'disabled'}. Bare-ground walking is unchanged.`,
    `Gathering scenery: ${gathering.gatheringScenery}, ${gathering.gatheringTownDistance} m beyond towns, ${gathering.gatheringRecentSeconds} s recent-use window.`,
    s.requireCaptainSkill ? 'Boats longer than the motorboat need the captain skill.' : '',
    `Flight contacts: ${flight.flightStrictLanding ? 'strict' : 'custom/default'}, maximum sink ${limits.sink} m/s, bank ${Math.round((limits.bank * 180) / Math.PI)}°, speed ${limits.speed} m/s. Airbrake ${flight.flightAirbrake ? 'enabled' : 'disabled'}; approach ${flight.flightApproachSpeed} m/s. Public runway target ${flight.runwayLength} × ${flight.runwayWidth} m, shoulder ${flight.runwayShoulder} m.`,
    s.loseBoatsOnDeath
      ? 'Owned boats and everything aboard are lost on death.'
      : `Boats remain offshore for recovery after death; ${s.boatCargoSpoilageDays === 0 ? 'cargo does not expire' : `cargo spoils after ${s.boatCargoSpoilageDays ?? 5} game days`}; tank fuel is ${s.retainBoatFuelOnDeath === false ? 'lost' : 'retained'}.`,
    s.postDeathGraceSeconds
      ? `Rebirth pauses needs for ${s.postDeathGraceSeconds / 60} real minutes.`
      : '',
    s.maxOfflineDays ? `Absence limit: ${s.maxOfflineDays} real days.` : 'No absence-limit death.',
  ]
    .filter(Boolean)
    .join(' ');
}
