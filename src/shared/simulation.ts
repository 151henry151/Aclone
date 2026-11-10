import { earthworkAction, workEarthwork, weatherEarthworks } from './earthworks-work';
import { cancelEarthworksOnDeath } from './earthworks-contracts';
import { slopeAssessment, slopeBypass } from './construction-slope';
import { coolingInterval } from './highway-refrigeration';
import { highwayControls, highwaySurface, clearHighwayRig } from './highway-driving';
import { isEarthmover } from './earthmoving-definitions';
import { HIGHWAY_TRACTOR, isSemitrailer, semiProducts } from './highway-definitions';
import {
  automotiveConfig,
  patchAutomotive,
  validateAutomotiveReferences,
} from './automotive-config';
import {
  manufacturingAction,
  manufacturingSkill,
  advanceManufacturing,
  clearManufacturingEstate,
} from './automotive-manufacturing';
import { advanceBridgeInspections } from './bridge-inspection';
import { bridgeGroundBlocked, updateBridgePassages } from './bridge-geometry';
import { bridgeAction, advanceBridgeSurveys, maintainBridges } from './bridges';
import { bridgeRuleFields, bridgeRulesError } from './bridge-rules';
import { nameTagFields, nameTagRules } from './name-tag-rules';
import { roadRuleFields } from './road-rules';
import { beginVehicleMount } from './vehicle-mount';
import { kerbParking } from './parking-site';
import { approachBuilding, exitBuilding, finishArrival, animatedArrival } from './arrival';
import { towExpiredParking } from './parking-tow';
import { parkedFootprintBlocked, vehicleFootprint } from './vehicle-footprint';
import { garageStorageAction } from './garage-storage';
import { garageOccupied } from './stored-trailers';
import { parkingFields, parkingRules } from './parking-rules';
import {
  migrateParkedVehicles,
  GARAGE_STORAGE,
  tractorGarage,
  removeAbsentParking,
  relocatedParkedTrailers,
  clearParkedRig,
  parkAtHome,
  leaveParkedHome,
  parkedVehicle,
  parkedReturnReason,
  persistentVehicles,
  parkedRefuelStatus,
  switchPersistentVehicle,
} from './parked-vehicles';
import { buildingDoorFields } from './building-doors';
import { livestockRuleFields, livestockRules } from './livestock-rules';
import { transferStock } from './stock-life';
import { butcherAction } from './butcher';
import { homeCook, setMeatMenu } from './cooking';
import { meatRuleFields, meatRules } from './meat-rules';
import { worldMeatRecipe, rawMeats } from './meat-recipes';
import { expireMeat, expireMeatStock, addFreshMeat, consumeStock } from './meat-freshness';
import {
  pumpHouseSite,
  refreshPumpRecipes,
  waterProductionBlocker,
  freshWaterReason,
} from './fresh-water';
import { waterSourceRuleFields, waterSourceRules } from './water-source-rules';
import { advanceCapsizing } from './storm-capsizing';
import { stormRuleFields } from './storm-rules';
import { ROWBOAT, rowboatRules, rowboatRuleFields } from './rowboat-rules';
import { landingAccepts } from './boathouse';
import { freightTradeCost } from './freight-accounting';
import {
  boatHoldAction,
  saveFreightCargo,
  freightAccess,
  freightShop,
  freightAccepts,
  queueFreight,
} from './boat-hold';
import {
  onSolidGround,
  sceneryContact,
  sceneryBlocksSegment,
  playerContact,
  stopGroundVehicle,
} from './ground-contacts';
import { parkingBlocker } from './ground-parking';
import {
  obstacleRuleFields,
  obstacleRuleKeys,
  solidSceneryModes,
  vehicleCollisionModes,
} from './obstacle-rules';
import { landscapeRules, landscapeRuleFields } from './landscape-rules';
import { communicationRuleFields } from './communication-rules';
import { calendarRuleFields, calendarRulesError } from './calendar-rules';
import { alpineRuleFields, alpineRulesError } from './alpine-rules';
import { climateRuleFields, climateRulesError } from './climate-rules';
import { boatNavigationRules, boatNavigationRuleFields } from './boat-navigation-rules';
import { vehicleRunningRuleFields } from './vehicle-running-rules';
import { fishingRuleFields } from './fishing-rules';
import { farmYieldRuleFields } from './farm-yield-rules';
import {
  gatheringRuleFields,
  gatheringImplementFields,
  gatheringImplementChoices,
} from './gathering-rules';
import { pastureParcelSize } from './pasture-land';
import { validFarmPlotCount } from './farm-land';
import { constructionRules, constructionRuleFields } from './construction-rules';
import { npcAccountRuleFields } from './npc-account-rules';
import { npcJourneyRuleFields } from './npc-journey-rules';
import { npcBusinessLoadRuleFields } from './npc-business-load-rules';
import { npcCargoRuleFields } from './npc-cargo-rules';
import { npcPricingRuleFields, npcPricingRulesError } from './npc-pricing-rules';
import { npcBusinessRuleFields, npcBusinessRulesError } from './npc-business-rules';
import { npcReserveRuleFields, npcReserveRulesError } from './npc-reserve-rules';
import { npcHouseholdRuleFields } from './npc-household-rules';
import { towingRuleFields, towingRulesError } from './towing-rules';
import { charterRuleFields, charterRulesError } from './charter-rules';
import { creditRuleFields, creditRulesError } from './credit-rules';
import { loanRuleFields, validLoanTerms, loanRulesError } from './loan-rules';
import {
  economyRules,
  economyRuleFields,
  governmentImportRuleKeys,
  lighthouseWage,
} from './economy-rules';
import {
  survivalRules,
  survivalRuleFields,
  skillFits,
  survivalRulesError,
  servingMultiplier,
} from './survival-rules';
import { radioAction, tickRadio } from './radio';
import { radioRuleFields } from './radio-rules';
import { canoeAction, canoeDeath } from './small-craft';
import { CANOE, canoeRules, canoeRuleFields } from './canoe-rules';
import { fuelRuleFields } from './fuel-rules';
import { fuelTrailerAction } from './fuel-sales';
import { inlandBlocksGround, riverDepth } from './inland-travel';
import { riverDockAccepts } from './river-dock';
import { surfaceWaterLevel } from './ocean';
import { inlandWaterAt } from './inland-water';
import { parishSpawn, buildingSpawnReason } from './spawn-reserve';
import { towingTender, tenderAction, moveTender } from './boat-tender';
import { tradingTrailer, trailerAccepts, trailerBlocks } from './trailers';
import {
  trailerAction,
  tuneTrailer,
  attachedTrailer,
  moveTrailer,
  trailerFactors,
  detachTrailer,
} from './trailers';
import {
  towAction,
  activeTow,
  beingTowed,
  moveTow,
  cancelPlayerTows,
  maintainTows,
} from './towing';
import { TUGBOAT, MOTORBOAT } from './boats';
import { hasMotor } from './vehicle-config';
import { cargoFitReason } from './cargo-fit';
import {
  vehicleDef,
  validateVehicleTuning,
  isTrawler,
  hasProvisions,
  crewBerths,
} from './vehicle-config';
import { ensurePastures, ensurePasture, pastureBlocker } from './pastures';
import { pastureCapacity, pastureCost } from './pasture-land';
import {
  charterAction as boatCharterAction,
  charterCaptain,
  advanceCharters,
  cancelChartersOnDeath,
  settleCharterPassenger,
  sameCharterDock,
} from './charter';
import { fishingVessel } from './boat-fishing';
import { CHARTER_BOAT, throttleBoat, cargoCrewPosition } from './boats';
import { bulkPurchaseQuote, validateBulkDiscounts } from './bulk-discounts';
import { cliffBlocks } from './coastal-bluffs';
import { isLighthouseKeeper } from './lodging';
import { boatShoreCollision } from './boat-shore';
import { highWater, waterLevel, oceanWeather, boatSeaPose, waveImpact } from './ocean';
import { automaticPantries, homeNeedsMultiplier } from './automatic-provisions';
import { changeBoatLighting } from './boat-lighting';
import {
  expeditionAction,
  vesselStoresWeight,
  stockWeight,
  boatLoadFactors,
  voyageFuel,
  voyageMeals,
  fishingCrewCaptain,
  seaFish,
  endVoyageOnDeath,
} from './fishing-expedition';
import { setSeafoodMenu } from './seafood';
import { trawlAction, advanceTrawl, trawlParameters } from './commercial-fishing';
import { FISHING_BOAT } from './boats';
import { poweredBoat, boatSlot, mooringKey } from './boats';
import { LIFEBOAT, rescueAction, abandonBoatOnDeath, expireAbandonedCargo } from './boat-rescue';
import { landedFish, scheduleBite } from './boat-fishing';
import {
  aboardBoat,
  withinBoatLanding,
  nearBoathouse,
  boatLanding,
  boatLandings,
  landingBlocked,
  type BoatLanding,
} from './boathouse';
import { commissionBiplane, hasAircraftHangar } from './airfield';
import { fly } from './flight.ts';
import { flightRuleFields } from './flight-rules';
import { walkingRuleFields } from './walking-rules';
import { gatheringSceneryFields, gatheringSceneryModes } from './gathering-scenery';
import {
  fuelCapacity,
  fuelVehicle,
  refuelRequiresReboarding,
  switchVehicle,
  isTractor,
  tractorSurface,
  returnTractor,
} from './tractors.ts';
import { playerStatistics, recordGathered } from './player-statistics.ts';
import { hiringLimit, jobVacancy, ownerOperating } from './staffing.ts';
import { salesReceipt } from './taxes.ts';
import { setTradingOffer } from './trading.ts';
import { maintenanceAction } from './maintenance.ts';
import {
  propertyContractAction,
  tickPropertyContracts,
  contractsOnDeath,
  contractsOnRemoval,
} from './property-contracts.ts';
import { roundCycleAction, tickRoundCycle } from './round-cycle.ts';
import { courseAction, tickCourses } from './courses.ts';
import { cancelGather } from './resources.ts';
import { buildingDesignQuote, type BuildingSize } from './building-designs';
import { constructionSiteReason, foundationProfile } from './construction-site';
import { migrateEmploymentPolicy } from './employment-policy.ts';
import { exportShipments } from './export-shipments.ts';
import { labourReward, labourQuote, noteLabourPaid, breakLabourStreak } from './public-labour.ts';
import { onFarmLand } from './farm-land.ts';
import { buildingBounds, buildingPlan } from './building-shapes.ts';
import { helmBlock } from './captain.ts';
import { constructionRefund } from './construction.ts';
import { crowClasses, crowAbility, returnCrow, type CrowClass } from './robocrows.ts';
import { lotteryAction, tickLottery } from './lottery.ts';
import { readBook, tickTownEvents } from './world-stories.ts';
import { drinkAlcohol, intoxicatedSteer } from './intoxication.ts';
import { socialAction } from './social.ts';
import {
  vehicleCondition,
  maintainable,
  vehicleRecord,
  recordTravel,
  repairStatus,
  repairRecipientReady,
  restoreVehicle,
  stoppedOutside,
} from './vehicle-services.ts';
import {
  herdSpec,
  herdShares,
  breedingBlocker,
  tendHerd,
  settleYoungGrowth,
  npcBreedingBudgetAllows,
  breedHerd,
  birthHerd,
  livestockOutputs,
} from './livestock.ts';
import { maximumHealth, nutritionEffects, feedShelterNow, nextShelterMeal } from './nutrition.ts';
import { landscapeAction, landscapeSchemaForRules } from './landscape.ts';
import {
  worldItems,
  worldSkills,
  skillLesson,
  setCatalogue,
  worldBuildings,
  applyBuildingTemplate,
} from './world-catalogue.ts';
import { checkActionGuards, questAction, questEvent, resetQuests } from './quests.ts';
import { fulfilOrder, refreshOrders, migrateProcurement } from './procurement.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { accounts, recordMoney, recordLife, addQuantities } from './reports.ts';
import {
  recordCreditIncome,
  advanceLoans,
  loanAction,
  settleForeclosure,
  forecloseEstate,
} from './loans.ts';
import { propertyQuote, releaseEstate, migrateEstates } from './property.ts';
import {
  addOutsideStake,
  applyOutsideCollect,
  collectableReturn,
  ownerWithdrawable,
  raiseWatermark,
  takeStakeRefunds,
} from './stakes.ts';
import {
  harbourSupply,
  emergencyImport,
  restockGovernmentStores,
  repriceGovernmentStores,
} from './harbour-supply.ts';
import {
  creatorAction,
  creatorEvent,
  tickCreator,
  creatorBlocks,
  creatorBlocksSegment,
  queueCreatorScript,
} from './creator.ts';
import { terrainHeight, mapHalf, legacyHalf, minMapSize, maxMapSize } from './terrain.ts';
import { fishingDock, travelHeight } from './dock';
export { terrainHeight, mapHalf } from './terrain.ts';
import { waterworksSite } from './shoreline.ts';
import { say, chatText } from './messages.ts';
export { say } from './messages.ts';
import { productionStaff, productionSupplied, productionEfficiency } from './sound-state';
import { removeOwnerEmployment } from './economy.ts';
import { expandedTown } from './town.ts';
import { growRoads } from './roads.ts';
import {
  charterAction,
  constructionTerms,
  findTown,
  residentList,
  setHomeTown,
  growTown,
  normalizeTowns,
  payTown,
  taxTown,
  tickTowns,
  townAction,
  type Town,
} from './civics.ts';
import { gather, finishGather, changeResourceRules } from './resources.ts';
import { moneyGiftReason, refuellingStatus } from './player-aid.ts';
import { advanceClimate, roadConditions, calendarYearSeconds } from './environment.ts';
import { drivingGrade, drivingSurface, walkingSurface, slopeSpeed } from './driving-surface.ts';
import { shelter, lodgingAction, roomCount } from './lodging.ts';
import { fireWeapon, tickCombat, joinCombat, leaveCombat, ammunition } from './combat.ts';
import {
  items,
  vehicles,
  buildings as catalog,
  recipes,
  defaults,
  skills,
  checkpoints,
} from './catalog.ts';
import { farmAction, finishHarvest, expireFarmCrops } from './farming.ts';
import {
  appearance,
  tractorPaint,
  vehiclePaint,
  paintableVehicle,
  migrateVehiclePaint,
} from './appearance.ts';
import { buildingBlocksMovement } from './building-shapes.ts';
import type { World, Player, Building, Stock, Action, Input, Ledger, Settings } from './types.ts';
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function money(value: number, rate = 100) {
  const d = value / 100;
  const s = Math.floor(d / rate);
  return `${s ? s.toLocaleString('en-US') + 's ' : ''}${Number((d - s * rate).toFixed(2))}d`;
}
export function damage(value: number, armour: number) {
  return (value * 100) / Math.max(1, armour);
}

function refundStakes(w: World, b: Building) {
  for (const { investor, amount } of takeStakeRefunds(b)) {
    const q = w.players[investor];
    if (q) {
      q.cash += amount;
      log(w, 'transfer', amount, b.id, investor, 'stake refund');
    } else log(w, 'sink', amount, b.id, 'treasury', 'stake refund');
  }
}

export function log(
  w: World,
  kind: Ledger['kind'],
  amount: number,
  from: string,
  to: string,
  reason: string,
  details?: Ledger['details'],
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw Error('Invalid ledger amount');
  if (amount) recordCreditIncome(w, to, amount, reason);
  if (amount) {
    const entry = {
      id: ++w.ledgerSeq,
      time: w.time,
      kind,
      amount,
      from,
      to,
      reason,
      ...(details ? { details } : {}),
    };
    w.ledger.push(entry);
    recordMoney(w, entry);
  }
}

export function makeBuilding(id: string, kind: string, x: number, z: number): Building {
  const d = catalog[kind];
  if (!d) throw Error('Unknown building type');
  return {
    id,
    kind,
    name: d.name,
    x,
    z,
    rotation: 0,
    price: d.price,
    investment: 0,
    stock: { ...d.stock },
    buy: { ...d.buy },
    sell: { ...d.sell },
    capacity: d.capacity,
    employees: [],
    wage: d.wage,
    progress: 0,
    efficiency: 1,
    condition: 100,
    government: false,
    ...(d.recipe ? { recipe: d.recipe } : {}),
  };
}
export function createWorld(
  id: string,
  name: string,
  owner: string,
  template = 'economy',
  now = Date.now() / 1000,
): World {
  const w: World = {
    schemaVersion: 1,
    id,
    name,
    owner,
    template,
    time: 0,
    created: now,
    settings: { ...defaults },
    vehicleTuning: {},
    players: {},
    buildings: [],
    townLayout: 2,
    tradePricing: 4,
    livestockPricing: 1,
    meatVersion: 1,
    animalPricing: 1,
    vehicleServicesPricing: 1,
    gatherToolsPricing: 1,
    hayPricing: 1,
    crewPricing: 1,
    exportShipment: 0,
    exportShipmentAt: 0,
    zones: [{ id: 'green', kind: 'safe', x: 0, z: 0, radius: 42 }],
    terrain: [],
    messages: [],
    ledger: [],
    ledgerSeq: 0,
    ball: { x: 90, z: 45, vx: 0, vz: 0 },
    scores: [0, 0],
    round: 0,
    projectiles: [],
    raceBest: {},
    towns: [{ name: 'Puddlewick', tax: 0.02, residents: [], wars: [] } as unknown as Town],
    tier: 0,
    script:
      '-- Aclone world script. Register an event with on("PlayerLogin", function(e) ... end).\non("PlayerLogin", function(e)\n  announce("Welcome to the parish. Mind the tractor.")\nend)',
    scriptVariables: {},
    assets: [],
    kricket: { due: 0, score: {} },
    revision: 0,
  };
  expandedTown.forEach(({ kind, x, z }, i) => {
    const b = makeBuilding('b' + i, kind, x, z);
    b.government = [
      'market',
      'school',
      'pub',
      'garage',
      'workhouse',
      'starport',
      'bank',
      'town',
    ].includes(kind);
    if (b.government) {
      b.owner = 'treasury';
      b.investment = 250000;
    }
    w.buildings.push(b);
  });
  migrateEmploymentPolicy(w);
  migrateEstates(w);
  migrateProcurement(w);
  if (template === 'combat') w.settings.fighting = true;
  if (template === 'playground') w.settings.hungerRate = w.settings.thirstRate = 0;
  // Arenas and sandboxes stay compact; only economy parishes open onto the wider countryside.
  if (template !== 'economy') w.settings.mapSize = 500;
  normalizeTowns(w);
  say(w, 'Parish notice', 'Welcome to ' + name + '. A small world. Plenty to get on with.');
  return w;
}
function parishSpawnPosition(w: World) {
  const point = parishSpawn(w.settings);
  return { x: point.x, y: travelHeight(w, point.x, point.z), z: point.z };
}
export function addPlayer(w: World, id: string, name: string): Player {
  if (w.players[id]) return w.players[id];
  const p: Player = {
    id,
    name,
    authority: id === w.owner ? 20 : 0,
    cash: w.settings.startingCash,
    bank: 0,
    kudos: 0,
    level: 1,
    ...parishSpawnPosition(w),
    heading: Math.PI,
    speed: 0,
    fuel: 64,
    health: survivalRules(w.settings).baseMaximumHealth,
    hunger: 5000,
    thirst: 5000,
    age: 18,
    inventory: { bread: 2, water: 3, tackle: 1, rc: 2 },
    skills: [],
    activeUntil: 0,
    atHome: false,
    vehicle: 0,
    engine: true,
    lights: false,
    team: 0,
    lastShot: -100,
    lastHorn: -100,
    energy: 65000,
    kills: 0,
    deaths: 0,
    muted: false,
    online: false,
    lastSeen: 0,
    repeats: 0,
    importDay: 0,
    imports: 0,
  };
  const mooredFleet = Object.values(w.mooredBoats ?? {})
    .filter((b) => b.owner === id)
    .map((b) => b.slot);
  if (mooredFleet.length) p.fleet = [0, 5, ...new Set(mooredFleet)];
  w.players[id] = p;
  playerStatistics(w, p, false);
  log(w, 'faucet', p.cash, 'treasury', id, 'starting cash');
  return p;
}
function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
function num(value: unknown, min: number, max: number, integer = false) {
  requireThat(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max &&
      (!integer || Number.isSafeInteger(value)),
    'Invalid number',
  );
  return value;
}
function str(value: unknown, max = 80) {
  requireThat(
    typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    'Invalid text',
  );
  return value.trim();
}
function qty(w: World, v: unknown) {
  return num(v, 1, economyRules(w.settings).transactionItemLimit, true);
}
function owner(p: Player) {
  requireThat(p.authority >= 20, 'Owner authority required');
}
export function withinBuildingRange(w: World, p: Player, b: Building) {
  if (p.inside === b.id) return true;
  return b.kind === 'boathouse'
    ? nearBoathouse(w, p, b)
    : persistentVehicles(w, p)
      ? distance(p, b) <= parkingRules(w.settings).arrivalRange
      : distance(p, b) < 18;
}
export function nearby(w: World, p: Player, id: unknown) {
  const b = w.buildings.find((x) => x.id === id);
  requireThat(b, 'Building not found');
  requireThat(withinBuildingRange(w, p, b), 'Drive near the building first');
  requireThat(!b.construction, 'Supply the construction materials first');
  return b;
}
function owns(p: Player, b: Building) {
  requireThat(p.authority >= 20 || b.owner === p.id, 'Only the building owner can do that');
}
export function canCarry(p: Player, item: string, n: number, w?: World) {
  const def = worldItems(w)[item];
  return !!def && carry(p, w) + def.weight * n <= vehicleDef(w, p.vehicle).capacity;
}
export function carry(p: Player, w?: World) {
  return (
    (p.carrying ? worldItems(w).canoe.weight : 0) +
    vesselStoresWeight(w, p) +
    Object.entries(p.inventory).reduce((s, [k, n]) => s + (worldItems(w)[k]?.weight ?? 0) * n, 0)
  );
}
function stockAdd(stock: Stock, item: string, n: number) {
  stock[item] = (stock[item] ?? 0) + n;
}
function charge(w: World, p: Player, amount: number, reason: string) {
  requireThat(p.cash >= amount, 'Not enough cash');
  p.cash -= amount;
  log(w, 'sink', amount, p.id, 'treasury', reason);
}
function grant(w: World, p: Player, amount: number, reason: string) {
  p.cash += amount;
  log(w, 'faucet', amount, 'treasury', p.id, reason);
}
function usable(w: World, p: Player, item: string) {
  expireMeatStock(w, p.inventory);
  const def = worldItems(w)[item];
  requireThat(def && (p.inventory[item] ?? 0) > 0, 'You do not carry that item');
  requireThat(
    !rawMeats.includes(item) || meatRules(w.settings).rawMeatEdible,
    'Raw meat must be cooked',
  );
  requireThat(
    def.food || def.drink || def.fuel || def.health || def.maxHealth,
    'That item is equipment or a trade good',
  );
  if (def.fuel) {
    requireThat(![CANOE, ROWBOAT].includes(p.vehicle), 'Canoes and rowboats need no fuel');
    requireThat(
      !refuelRequiresReboarding(p, w),
      'Carry the Fuel back to your main boat and reboard before refuelling it',
    );
    if (persistentVehicles(w, p) && p.vehicle === 5 && !boatSlot(fuelVehicle(p, w), w)) {
      const status = parkedRefuelStatus(w, p, p.id, fuelVehicle(p, w));
      requireThat(!status.reason, status.reason ?? 'Cannot refuel');
      status.vehicle!.fuel += status.units;
    } else {
      requireThat(p.fuel < fuelCapacity(p, w), 'The tank is full');
      p.fuel = Math.min(fuelCapacity(p, w), p.fuel + def.fuel);
    }
  } else {
    p.repeats = p.lastFood === item ? p.repeats + 1 : 0;
    p.lastFood = item;
    const scale = servingMultiplier(w.settings, p.repeats + 1);
    p.hunger = Math.max(0, p.hunger - (def.food ?? 0) * scale);
    p.thirst = Math.max(0, p.thirst - (def.drink ?? 0) * scale);
  }
  nutritionEffects(p, def, 1, w);
  drinkAlcohol(p, item, w.time);
  consumeStock(w, p.inventory, item, 1);
  if (
    (isTrawler(p.vehicle, w) || vehicleDef(w, p.vehicle).holdCapacity) &&
    p.fishingVoyage &&
    (def.food || def.drink)
  )
    p.fishingVoyage.expenses += p.fishingVoyage.provisionPrices[item] ?? 0;
}
// All request validation precedes mutation. The server additionally wraps actions in a transaction.
export function act(w: World, id: string, a: Action, completedFreight = false): string {
  const items = worldItems(w),
    skills = worldSkills(w);
  const p = w.players[id];
  requireThat(p, 'Unknown player');
  const type = a.type;
  if (
    p.carrying &&
    [
      'vehicle',
      'crow',
      'gather',
      'build',
      'work',
      'joinGame',
      'joinCombat',
      'hitch',
      'farm',
      'plant',
      'harvest',
      'fish',
      'reel',
      'buildSupply',
      'produce',
      'task',
      'construct',
      'supply',
      'production',
    ].includes(type)
  )
    throw Error('Set down your canoe before starting this activity');
  // Reject legacy clients before clearing courses or changing any other player state.
  if (type === 'respawn')
    throw Error(
      'Returning to town requires travel. Ask another player for fuel or recovery assistance.',
    );
  if (
    p.charterPassage &&
    ![
      'chat',
      'use',
      'detach',
      'charter',
      'giveMoney',
      'appearance',
      'paint',
      'joinGame',
      'leaveGame',
      'reel',
    ].includes(type)
  )
    throw Error('You are aboard a charter; return to a dock to disembark');
  const crewCaptain = fishingCrewCaptain(w, p);
  if (
    crewCaptain &&
    !['chat', 'use', 'detach', 'expedition', 'giveMoney', 'appearance', 'paint'].includes(type)
  )
    throw Error('You are aboard as a deckhand; wait until the expedition returns to port');
  if (
    Object.keys(p.fishingVoyage?.members ?? {}).length &&
    seaFish.includes(String(a.item)) &&
    ['trade', 'give', 'discard', 'offerTrade', 'stock', 'use'].includes(type)
  )
    throw Error(
      'Settle the expedition at the boatyard to sell the crew catch and pay agreed shares',
    );
  if (
    aboardBoat(w, p) &&
    (['crow', 'home', 'joinCombat'].includes(type) ||
      (type === 'joinGame' && (a.game !== 'fishing' || !fishingVessel(w, p))))
  )
    throw Error('Disembark at a boathouse before starting another activity');
  if (
    vehicleDef(w, p.vehicle).mode === 2 &&
    (p.flight ? !p.flight.grounded : p.y > travelHeight(w, p.x, p.z) + 0.25) &&
    (a.building ||
      [
        'vehicle',
        'crow',
        'home',
        'hitch',
        'joinGame',
        'joinCombat',
        'gather',
        'construct',
        'work',
        'learn',
        'course',
      ].includes(type))
  )
    throw Error('Land the aircraft before starting another activity');
  if (type === 'maintenance') return maintenanceAction(w, p, a);
  if (w.maintenance?.paused && type !== 'chat') throw Error('World paused for maintenance');
  if (type === 'propertyContract') return propertyContractAction(w, p, a);
  const contracted = w.buildings.find((b) => b.id === a.building);
  if (
    contracted &&
    (contracted.operatingLease || contracted.auction) &&
    ['buyBuilding', 'listProperty', 'demolish'].includes(type)
  )
    throw Error('Settle the existing property contract first');
  if (
    contracted?.auction &&
    ['stock', 'investment', 'buildingAdmin'].includes(type) &&
    contracted.owner === p.id
  )
    throw Error('Owner stock, capital and price changes are locked during the auction');
  if (contracted?.operatingLease && type === 'investment' && contracted.owner !== p.id)
    throw Error('Outside stakes cannot be added during an operating lease');
  if (
    p.crowBody &&
    ![
      'crow',
      'crowAbility',
      'fire',
      'chargeWeapon',
      'chat',
      'command',
      'horn',
      'engine',
      'lights',
    ].includes(type)
  )
    throw Error('Return from the robocrow before other activities');
  checkActionGuards(w, p, a);
  if (type === 'roundCycle') return roundCycleAction(w, p, a);
  if (type === 'construct' && w.roundCycle?.phase === 'war')
    throw Error('Wait for the build or peace phase before construction');
  if (type === 'course') return courseAction(w, p, a);
  if (['joinGame', 'vehicle', 'outside', 'home', 'crow'].includes(type)) delete p.courseRun;
  if (type === 'landscape') return landscapeAction(w, p, a);
  if (type === 'catalogue') {
    setCatalogue(w, p, a.catalogue);
    return 'World catalogue saved.';
  }
  if (type === 'readBook') {
    readBook(w, p, str(a.book));
    return '';
  }
  if (type === 'lottery') return lotteryAction(w, p, a);
  if (type === 'foundTown' || type === 'town') return townAction(w, p, a);
  requireThat(
    !towingTender(w, p) ||
      !['vehicle', 'home', 'crow', 'hitch', 'takeoff', 'joinGame', 'lifeboat', 'tow'].includes(
        type,
      ),
    'Secure your motorboat tender at a dock first',
  );
  requireThat(
    !attachedTrailer(w, p) ||
      (persistentVehicles(w, p) && ((type === 'vehicle' && a.slot === 5) || type === 'home')) ||
      !['vehicle', 'home', 'crow', 'hitch', 'takeoff', 'joinGame'].includes(type),
    'Unhitch your trailer before changing vehicles or activity',
  );
  requireThat(
    !activeTow(w, p.id) ||
      !['vehicle', 'home', 'crow', 'respawn', 'hitch', 'takeoff', 'lifeboat', 'joinGame'].includes(
        type,
      ),
    'Release the towline before leaving your tug',
  );
  requireThat(
    !beingTowed(w, p) || ['tow', 'lights', 'boatLights', 'chat', 'use'].includes(type),
    'Release the towline before changing your vessel or activity',
  );
  if (type === 'garageStorage') return garageStorageAction(w, p, a);
  if (type === 'townCharter') return charterAction(w, p, a);
  if (type === 'quest') return questAction(w, p, a);
  if (
    ['creator', 'creatorBuilding', 'creatorRemove', 'creatorRecipe', 'interactObject'].includes(
      type,
    )
  )
    return creatorAction(w, p, a);
  let result = ''; // Routine success is acknowledged without a generic notification.
  switch (type) {
    case 'automotiveConfig': {
      requireThat(w.owner === p.id, 'World owner required');
      const next = patchAutomotive(w, a.patch);
      validateAutomotiveReferences(next, items, skills);
      for (const t of Object.values(w.trailers ?? {}))
        if (isSemitrailer(t.kind))
          requireThat(
            stockWeight(w, t.cargo) <= next.semitrailers[semiProducts[t.kind]].capacity,
            'Unload semitrailer cargo before reducing capacity',
          );
      for (const t of Object.values(w.trailers ?? {}))
        if (t.kind === 'semiRefrigerated')
          requireThat(
            coolingInterval(w, t).fuel <= next.refrigeration.fuelCapacity,
            'Use refrigeration fuel before reducing tank capacity',
          );
      const old = automotiveConfig(w);
      for (const t of Object.values(w.trailers ?? {})) {
        if (!isSemitrailer(t.kind) || !t.attached) continue;
        const product = semiProducts[t.kind];
        requireThat(
          JSON.stringify(old.coupling) === JSON.stringify(next.coupling) &&
            (['length', 'width', 'height'] as const).every(
              (key) => old.semitrailers[product][key] === next.semitrailers[product][key],
            ),
          'Unhitch semitrailers before changing their geometry or coupling dimensions',
        );
      }
      expireMeat(w);
      w.automotive = next;
      break;
    }
    case 'manufacturing':
      result = manufacturingAction(w, p, a);
      break;
    case 'tender':
      return tenderAction(w, p, a.operation);
    case 'boatHold':
      return boatHoldAction(w, p, a, completedFreight);
    case 'trailer':
      return trailerAction(w, p, a);
    case 'tow':
      return towAction(w, p, a);
    case 'charter':
      result = boatCharterAction(w, p, a);
      break;
    case 'boatIdle':
      requireThat(throttleBoat(p.vehicle, w) && !p.hitch, 'Board your powered boat');
      p.boatThrottle = 0;
      break;
    case 'seafoodMenu':
      result = setSeafoodMenu(w, p, nearby(w, p, a.building), a.menu);
      break;
    case 'butcher':
      return butcherAction(w, p, a);
    case 'meatMenu':
      return setMeatMenu(w, p, nearby(w, p, a.building), a.menu);
    case 'cook':
      return homeCook(w, p, a);
    case 'expedition':
      result = expeditionAction(w, p, a);
      break;
    case 'trawl':
      result = trawlAction(w, p, a.operation);
      break;
    case 'lifeboat':
      return rescueAction(w, p, a.operation);
    case 'livestock': {
      const b = nearby(w, p, a.building);
      ensurePasture(w, b);
      if (a.operation === 'expand') {
        owns(p, b);
        requireThat(
          herdSpec(b) && !b.construction && !p.task,
          'Visit a completed livestock farm while free',
        );
        requireThat(b.pasture, 'No clear grazing parcel is available near this barn');
        const next = { ...b.pasture!, parcels: b.pasture!.parcels + 1 };
        const blocker = pastureBlocker(w, b, next, b.pasture!.parcels, undefined, p);
        requireThat(!blocker, blocker ?? 'Cannot expand here');
        const price = pastureCost(b, w.settings.pasturePriceMultiplier ?? 1);
        requireThat(p.cash >= price, 'Not enough personal cash for pasture land');
        p.cash -= price;
        b.price += price;
        b.pasture = next;
        log(w, 'sink', price, p.id, 'land-registry', 'pasture land purchase');
        result = `Pasture expanded to ${next.parcels * pastureParcelSize(next) ** 2} square metres.`;
        break;
      }
      if (a.operation === 'continuous') {
        owns(p, b);
        requireThat(herdSpec(b) && !b.construction, 'Choose a completed livestock farm');
        requireThat(typeof a.enabled === 'boolean', 'Choose whether to enable continuous breeding');
        requireThat(
          !a.enabled || livestockRules(w.settings).livestockContinuousAllowed,
          'Continuous breeding is disabled in this world',
        );
        b.continuousBreeding = a.enabled;
        result = a.enabled
          ? 'Continuous breeding enabled; maintain healthy parents, rations, investment and pasture space.'
          : 'Continuous breeding stopped; an existing pregnancy will finish.';
        break;
      }
      requireThat(a.operation === 'breed', 'Unknown livestock operation');
      const cost = breedHerd(w, p, b);
      log(w, 'sink', cost, b.id, 'treasury', 'livestock breeding');
      result = 'Breeding arranged. Keep the herd fed and cared for during the next hour.';
      break;
    }
    case 'fulfilOrder':
      result = fulfilOrder(w, p, a);
      break;
    case 'farm': {
      farmAction(w, p, nearby(w, p, a.building), a);
      break;
    }
    case 'fuelTrailer':
      return fuelTrailerAction(w, p, a);
    case 'trade': {
      const b =
          a.storage === 'hold' ? freightShop(w, p, a.slot, a.building) : nearby(w, p, a.building),
        item = str(a.item);
      requireThat(b.owner !== id, 'Owners use the Stockroom, not trades with their own building');
      requireThat(items[item], 'Unknown item');
      const n = qty(w, a.quantity);
      requireThat(a.direction === 'buy' || a.direction === 'sell', 'Invalid trade direction');
      const buying = a.direction === 'buy';
      const trailer =
        a.storage === 'trailer'
          ? tradingTrailer(w, p, a.trailer === undefined ? undefined : str(a.trailer))
          : undefined;
      requireThat(
        a.storage === undefined || a.storage === 'trailer' || a.storage === 'hold',
        'Unknown cargo storage',
      );
      if (a.storage === 'trailer')
        requireThat(
          trailer &&
            trailer.owner === p.id &&
            Math.abs(p.speed) < 0.5 &&
            Math.hypot(trailer.x - b.x, trailer.z - b.z) <= 30,
          'Pull your hitched trailer alongside this shop and stop',
        );
      const cargo =
        a.storage === 'hold'
          ? freightAccess(w, p, a.slot).cargo
          : trailer
            ? trailer.cargo
            : p.inventory;
      const price = (buying ? b.sell : b.buy)[item];
      requireThat(
        Number.isSafeInteger(price) &&
          price >= (buying ? 0 : economyRules(w.settings).minimumBuyPrice),
        'This building does not trade that item',
      );
      requireThat(
        a.expectedPrice === undefined || a.expectedPrice === price,
        'The price changed. Review the current price before trading again.',
      );
      const total = buying ? bulkPurchaseQuote(b, price, n).total : price * n;
      requireThat(
        a.expectedTotal === undefined || a.expectedTotal === total,
        'The price or bulk discount changed. Review the current total before trading again.',
      );
      requireThat(Number.isSafeInteger(total), 'Trade too large');
      const day = Math.floor(w.time / 600);
      const imports = p.importDay === day ? p.imports : 0;
      if (buying) {
        if (herdSpec(b, w.settings)?.animal === item)
          requireThat(
            (b.stock[item] ?? 0) - n >= herdSpec(b, w.settings)!.minimum,
            `This herd keeps ${herdSpec(b, w.settings)!.minimum} breeding ${item}; only surplus animals are for sale`,
          );
        requireThat((b.stock[item] ?? 0) >= n || emergencyImport(w, b, item), 'Not enough stock');
        requireThat(p.cash >= total, 'Not enough cash');
        requireThat(
          a.storage === 'hold'
            ? freightAccepts(w, p, a.slot, item, n)
            : trailer
              ? trailerAccepts(w, trailer, item, n)
              : canCarry(p, item, n, w),
          'Cargo hold is full or unsuitable',
        );
        if (b.kind === 'starport')
          requireThat(imports + n <= w.settings.importCap, 'Daily port import limit reached');
      } else {
        requireThat((cargo[item] ?? 0) >= n, 'Not enough items');
        requireThat(b.investment >= total, 'Building has insufficient investment');
        requireThat((b.stock[item] ?? 0) + n <= b.capacity, 'Building storage is full');
        requireHerdRoom(w, b, item, n);
      }
      if (a.storage === 'hold' && !completedFreight)
        return queueFreight(w, p, { ...a, expectedPrice: price, expectedTotal: total });
      if (a.storage === 'hold')
        freightTradeCost(w, p, Number(a.slot), cargo, item, n, buying, total);
      if (buying) {
        const town = taxTown(w, b.x, b.z);
        const { worldTax, townTax, tax } = salesReceipt(w, b, total);
        const imported = emergencyImport(w, b, item) ? Math.max(0, n - (b.stock[item] ?? 0)) : 0;
        const importCost = imported ? Math.floor((((total - tax) * imported) / n) * 0.8) : 0;
        if (imported) stockAdd(b.stock, item, imported);
        p.cash -= total;
        b.investment += total - tax - importCost;
        if (importCost)
          log(w, 'sink', importCost, b.id, 'imports', `emergency shipment: ${imported} ${item}`);
        transferStock(w, b.stock, cargo, item, n);
        log(w, 'transfer', total - tax, id, b.id, 'purchase', {
          building: b.id,
          item,
          quantity: n,
        });
        log(w, 'sink', worldTax, id, 'treasury', 'sales tax', {
          building: b.id,
          item,
          quantity: n,
        });
        if (town) payTown(w, town, id, townTax, 'sales tax');
        if (b.kind === 'starport') {
          p.importDay = day;
          p.imports = imports + n;
        }
      } else {
        p.cash += total;
        b.investment -= total;
        transferStock(w, cargo, b.stock, item, n);
        log(w, 'transfer', total, b.id, id, 'sale', { building: b.id, item, quantity: n });
      }
      if (a.storage === 'hold') saveFreightCargo(w, p, Number(a.slot), cargo);
      questEvent(w, p, buying ? 'buy' : 'sell', b.id, item, n);
      queueCreatorScript(w, 'TradeComplete', {
        id,
        building: b.id,
        item,
        quantity: n,
        amount: total,
        direction: a.direction as string,
      });
      addQuantities(buying ? accounts(w, b).sold : accounts(w, b).bought, { [item]: n });
      result = `${buying ? 'Bought' : 'Sold'} ${n} ${items[item].name} for ${money(total, w.settings.denariiPerSheckle)}.`;
      recordLife(w, p, {
        kind: 'trade',
        text: result,
        building: b.id,
        item,
        quantity: n,
        amount: total,
      });
      break;
    }
    case 'discard': {
      const item = str(a.item),
        n = qty(w, a.quantity);
      requireThat(
        Object.hasOwn(items, item) && (p.inventory[item] ?? 0) >= n,
        'You do not carry that quantity',
      );
      consumeStock(w, p.inventory, item, n);
      result = `Discarded ${n} ${items[item].name}.`;
      break;
    }
    case 'spring': {
      owner(p);
      const springId = str(a.id, 120);
      requireThat(/^spring-[a-zA-Z0-9:_-]+$/.test(springId), 'Use a spring- identifier');
      const list = w.springs ?? [];
      if (a.operation === 'delete') {
        requireThat(
          list.some((s) => s.id === springId),
          'Unknown spring',
        );
        w.springs = list.filter((s) => s.id !== springId);
      } else {
        requireThat(a.operation === 'save', 'Choose save or delete');
        const spring = {
          id: springId,
          x: num(a.x, -mapHalf(w), mapHalf(w)),
          z: num(a.z, -mapHalf(w), mapHalf(w)),
          flow: num(
            a.flow,
            waterSourceRuleFields.springMinimumFlow.min,
            waterSourceRuleFields.springMaximumFlow.max,
          ),
        };
        requireThat(
          list.length < 1000 || list.some((s) => s.id === springId),
          'Spring limit reached',
        );
        const prior = list.find((s) => s.id === springId);
        w.springs = [
          ...list.filter((s) => s.id !== springId),
          { ...spring, ...(prior?.river ? { river: prior.river } : {}) },
        ];
      }
      w.waterSourcesVersion = 1;
      refreshPumpRecipes(w);
      w.revision++;
      result = 'Spring survey updated. Existing intakes keep their saved position.';
      break;
    }
    case 'drinkSpring': {
      const r = waterSourceRules(w.settings);
      requireThat(
        r.springsEnabled && r.springDrinkingEnabled,
        'Spring drinking is disabled in this world',
      );
      requireThat(
        p.vehicle === 5 && !p.hitch && !p.atHome && !p.task && !p.game && Math.abs(p.speed) < 0.5,
        'Stop on foot outside to drink from a spring',
      );
      const spring = w.springs?.find((s) => s.id === str(a.spring));
      requireThat(
        spring && distance(p, spring) <= r.springDrinkRange,
        `Stand within ${r.springDrinkRange} m of the spring`,
      );
      requireThat(
        w.time - (p.lastSpringDrink ?? -Infinity) >= r.springDrinkCooldown,
        `Wait ${r.springDrinkCooldown} seconds between spring drinks`,
      );
      p.repeats = p.lastFood === 'water' ? p.repeats + 1 : 0;
      p.lastFood = 'water';
      p.thirst = Math.max(
        0,
        p.thirst - (items.water.drink ?? 0) * servingMultiplier(w.settings, p.repeats + 1),
      );
      p.lastSpringDrink = w.time;
      result = 'Drank from the spring. No water was bottled.';
      break;
    }
    case 'use':
      usable(w, p, str(a.item));
      result = 'That should help.';
      break;
    case 'buyBuilding': {
      const b = nearby(w, p, a.building);
      requireThat(!b.government && b.owner !== id, 'This property is not for sale');
      requireThat(!b.owner || b.forSale, 'The owner has not listed this property');
      const price = propertyQuote(w, b).total;
      requireThat(p.cash >= price, 'Not enough cash');
      const homes = b.kind === 'home' || b.kind === 'warehouse';
      requireThat(
        w.buildings.filter(
          (b) =>
            (b.owner === id || b.operatingLease?.landlord === id) &&
            (homes
              ? ['home', 'warehouse'].includes(b.kind)
              : !['home', 'warehouse'].includes(b.kind)),
        ).length < (homes ? w.settings.maxHomes : w.settings.maxBuildings),
        'Property limit reached',
      );
      const seller = b.owner && w.players[b.owner];
      if (settleForeclosure(w, b, p, price)) {
        // Foreclosure receipts already allocate bank recovery and former-owner surplus.
      } else if (seller) {
        p.cash -= price;
        seller.cash += price;
        log(w, 'transfer', price, p.id, seller.id, 'property sale');
      } else charge(w, p, price, 'property purchase');
      if (seller)
        recordLife(w, seller, {
          kind: 'property',
          building: b.id,
          text: `Sold ${b.name}`,
          amount: price,
        });
      recordLife(w, p, {
        kind: 'property',
        building: b.id,
        text: `Purchased ${b.name}`,
        amount: price,
      });
      b.owner = id;
      delete b.estate;
      delete b.leaseOffer;
      removeOwnerEmployment(w, b);
      b.forSale = false;
      result = `You now own ${b.name}. Bring a broom.`;
      break;
    }
    case 'unlistProperty': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(!b.auction, 'End the auction through its own controls');
      b.forSale = false;
      result = 'Property removed from sale.';
      break;
    }
    case 'listProperty': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(!b.government, 'Government property is not for sale');
      requireThat(!b.lien, 'Repay the mortgage before listing this property');
      b.price = num(a.price, 1, 100000000, true);
      b.forSale = true;
      delete b.leaseOffer;
      result = 'Property listed for sale.';
      break;
    }
    case 'production': {
      owner(p);
      const b = nearby(w, p, a.building);
      requireThat(
        b.kind !== 'automotiveFactory',
        'Use the automotive manufacturing rules and assembly orders',
      );
      requireThat(b.kind !== 'farm', 'Farm plots use the seasonal crop calendar');
      const readStock = (v: unknown) => {
        requireThat(v && typeof v === 'object' && !Array.isArray(v), 'Expected an item map');
        const stock: Stock = {};
        requireThat(Object.keys(v).length <= 8, 'At most eight recipe items');
        for (const [item, n] of Object.entries(v)) {
          requireThat(Object.hasOwn(items, item), 'Unknown item');
          stock[item] = num(n, 1, 1000, true);
        }
        return stock;
      };
      const inputs = readStock(a.inputs),
        outputs = readStock(a.outputs),
        seconds = num(a.seconds, 10, 86400, true),
        skill = str(a.skill);
      requireThat(
        skills.includes(skill) && Object.keys(outputs).length > 0,
        'Choose a valid profession and output',
      );
      b.production = { inputs, outputs, seconds, skill, tier: 0 };
      delete b.pumpRecipeManaged;
      b.progress = 0;
      break;
    }
    case 'vehicleReset': {
      owner(p);
      const slot = num(a.slot, 0, vehicles.length - 1, true);
      validateVehicleTuning(w, slot, {}, true);
      if (w.vehicleTuning) delete w.vehicleTuning[slot];
      w.revision++;
      break;
    }
    case 'trailerTuning': {
      owner(p);
      requireThat(a.kind === 'fuel', 'Choose the fuel tanker');
      tuneTrailer(w, { price: a.price, capacity: a.capacity });
      w.revision++;
      break;
    }
    case 'vehicleTuning': {
      owner(p);
      const slot = num(a.slot, 0, vehicles.length - 1, true);
      const { type, slot: unused, replace, tuning: inputTuning, ...fields } = a;
      const tuning = validateVehicleTuning(w, slot, inputTuning ?? fields, replace === true);
      w.vehicleTuning ??= {};
      w.vehicleTuning[slot] = replace === true ? tuning : { ...w.vehicleTuning[slot], ...tuning };
      w.revision++;
      break;
    }
    case 'investment': {
      const b = nearby(w, p, a.building);
      const n = num(a.amount, 1, economyRules(w.settings).cashTransferLimit, true);
      requireThat(a.direction === 'deposit' || a.direction === 'withdraw', 'Invalid direction');
      const proprietor = b.owner === p.id || (p.authority >= 20 && a.caretaker === true);
      if (proprietor) {
        if (a.direction === 'deposit') {
          requireThat(p.cash >= n, 'Not enough cash');
          p.cash -= n;
          b.investment += n;
          if (b.stakes?.length || b.watermark !== undefined) raiseWatermark(b, n);
          log(w, 'transfer', n, id, b.id, 'investment');
        } else {
          requireThat(
            n <= ownerWithdrawable(w, b),
            'Outside stakes lock that cash in the till until investors are paid',
          );
          requireThat(b.investment >= n, 'Not enough investment');
          b.investment -= n;
          p.cash += n;
          log(w, 'transfer', n, b.id, id, 'withdrawal');
        }
      } else {
        requireThat(!b.government, 'Public buildings do not take private stakes');
        if (a.direction === 'deposit') {
          requireThat(p.cash >= n, 'Not enough cash');
          p.cash -= n;
          b.investment += n;
          addOutsideStake(w, b, id, n);
          log(w, 'transfer', n, id, b.id, 'outside stake');
        } else {
          const due = collectableReturn(w, b, id);
          requireThat(due > 0, 'No earned return is available yet');
          requireThat(n <= due, 'That exceeds the collectable return');
          const paid = applyOutsideCollect(w, b, id, n);
          p.cash += paid;
          log(w, 'transfer', paid, b.id, id, 'investor return');
        }
      }
      break;
    }
    case 'canoe':
      canoeAction(w, p, a);
      break;
    case 'stock': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      const item = str(a.item),
        n = qty(w, a.quantity);
      requireThat(items[item], 'Unknown item');
      requireThat(['deposit', 'withdraw'].includes(String(a.direction)), 'Invalid direction');
      const put = a.direction === 'deposit';
      const source = put ? p.inventory : b.stock;
      requireThat((source[item] ?? 0) >= n, 'Not enough stock');
      requireThat(
        put ? (b.stock[item] ?? 0) + n <= b.capacity : canCarry(p, item, n, w),
        'Storage full',
      );
      if (put && item === 'canoe' && b.kind === 'home')
        requireThat(
          (b.stock.canoe ?? 0) + n <= canoeRules(w.settings).canoeHomeLimit,
          'Home canoe limit is full',
        );
      if (put) requireHerdRoom(w, b, item, n);
      transferStock(w, source, put ? b.stock : p.inventory, item, n);
      break;
    }
    case 'buildingAdmin': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      const name = a.name === undefined ? b.name : str(a.name, 48);
      const wage = a.wage === undefined ? b.wage : num(a.wage, 0, 1000000, true);
      let price: number | undefined, item: string | undefined;
      if (a.item !== undefined) {
        item = str(a.item);
        requireThat(items[item], 'Unknown item');
        requireThat(a.side === 'buy' || a.side === 'sell', 'Invalid price side');
        requireThat(
          a.enabled === undefined || typeof a.enabled === 'boolean',
          'Invalid trading status',
        );
        if (a.enabled !== false)
          price = num(
            a.price ?? b.pausedPrices?.[a.side]?.[item] ?? b[a.side][item],
            a.side === 'buy' ? economyRules(w.settings).minimumBuyPrice : 0,
            10000000,
            true,
          );
      }
      const bulk =
        a.bulkDiscounts === undefined || a.bulkDiscounts === null
          ? a.bulkDiscounts
          : validateBulkDiscounts(a.bulkDiscounts);
      if (bulk === null) delete b.bulkDiscounts;
      else if (bulk !== undefined) b.bulkDiscounts = bulk;
      b.name = name;
      b.wage = b.kind === 'lighthouse' ? lighthouseWage(w.settings, wage) : wage;
      if (item) setTradingOffer(b, a.side as 'buy' | 'sell', item, a.enabled !== false, price, w);
      break;
    }
    case 'staffing': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(
        b.kind === 'automotiveFactory' || b.recipe || b.production,
        'No employment at this building',
      );
      const limit = a.limit === undefined ? undefined : num(a.limit, 0, 16, true);
      if (a.dismiss !== undefined) {
        const id = str(a.dismiss);
        requireThat(b.employees.includes(id), 'That worker is no longer employed here');
        const worker = w.players[id];
        requireThat(
          !worker?.task || worker.task.building !== b.id,
          'Wait until this worker finishes their current task',
        );
        b.employees = b.employees.filter((e) => e !== id);
        b.dismissedUntil ??= {};
        b.dismissedUntil[id] = w.time + 3600;
        if (worker?.job === b.id) {
          delete worker.job;
          worker.activeUntil = 0;
          recordLife(w, worker, {
            kind: 'job',
            building: b.id,
            text: `Dismissed from ${b.name}; may reapply in one hour.`,
          });
          queueCreatorScript(w, 'JobChanged', { id, building: '', previous: b.id });
          say(
            w,
            b.name,
            'Your employment has ended. You may reapply here in one hour.',
            'system',
            id,
          );
        }
      }
      if (limit !== undefined) b.hiringLimit = limit;
      if (a.automatic === true) delete b.hiringLimit;
      result = 'Staffing settings updated. Existing workers remain until dismissed.';
      break;
    }
    case 'job': {
      requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      const b = nearby(w, p, a.building);
      requireThat(
        b.kind === 'lighthouse' || b.owner !== id,
        'You cannot take paid work or tasks at your own building',
      );
      requireThat(!p.job || p.job === b.id, 'Quit your current job first');
      const recipe =
        b.kind === 'automotiveFactory'
          ? { skill: manufacturingSkill(w, b) }
          : b.kind === 'farm'
            ? recipes.farm
            : (b.production ?? (b.recipe && recipes[b.recipe]));
      requireThat(recipe || b.kind === 'lighthouse', 'No work at this building');
      requireThat(
        b.kind === 'lighthouse' || (recipe && p.skills.includes(recipe.skill)),
        'Learn ' + (recipe && recipe.skill) + ' at the school first',
      );
      // Reaccepting an existing job renews its shift without a second staff slot.
      if (!b.employees.includes(id)) {
        requireThat(
          (b.dismissedUntil?.[id] ?? 0) <= w.time,
          'You were recently dismissed; reapply after one hour',
        );
        requireThat(jobVacancy(w, b, id), `All jobs filled (hiring limit ${hiringLimit(w, b)})`);
        b.employees.push(id);
      }
      if (p.job !== b.id) {
        recordLife(w, p, { kind: 'job', building: b.id, text: `Took a job at ${b.name}` });
        breakLabourStreak(p);
      }
      if (p.job !== b.id) questEvent(w, p, 'job', b.id);
      queueCreatorScript(w, 'JobChanged', { id, building: b.id, previous: p.job ?? '' });
      p.job = b.id;
      if (b.kind === 'lighthouse') {
        b.lodging ??= { open: false, rate: 0, guests: {} };
        b.lodging.guests[id] ??= { until: Number.MAX_SAFE_INTEGER, stock: {} };
      }
      p.activeUntil = w.time + 2 * productionInterval(w, b);
      result =
        b.kind === 'lighthouse'
          ? 'You are the lighthouse keeper. Your private quarters are available while employed; bring food and water. The navigation service funds your daily wage.'
          : w.settings.activeWork
            ? 'Employed here and working for the next two cycles; production is scheduled, not instant.'
            : 'Employed here without shift renewal, including offline. Factory wages require funded production; farms pay for completed harvests.';
      break;
    }
    case 'quit': {
      if (p.job) {
        const b = w.buildings.find((b) => b.id === p.job);
        if (b) b.employees = b.employees.filter((e) => e !== id);
        recordLife(w, p, { kind: 'job', building: p.job, text: `Left job at ${b?.name ?? p.job}` });
        queueCreatorScript(w, 'JobChanged', { id, building: '', previous: p.job });
        delete p.job;
      }
      break;
    }
    case 'work': {
      const b = nearby(w, p, a.building);
      if (b.kind !== 'lighthouse' && w.settings.ownerOperation && b.owner === p.id) {
        const recipe =
          b.kind === 'automotiveFactory'
            ? { skill: manufacturingSkill(w, b) }
            : (b.production ?? (b.recipe && recipes[b.recipe]));
        requireThat(
          recipe && b.kind !== 'farm',
          'This business uses different production controls',
        );
        requireThat(p.skills.includes(recipe.skill), 'Learn ' + recipe.skill + ' first');
        b.ownerActiveUntil = w.time + 2 * productionInterval(w, b);
        result = w.settings.activeWork
          ? 'Operating your business for two cycles without wages.'
          : 'Qualified owner operation continues without wages, including offline; inputs are still required.';
        break;
      }
      requireThat(
        b.kind === 'lighthouse' || b.owner !== id,
        'You cannot take paid work or tasks at your own building',
      );
      requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      requireThat(p.job === b.id, 'Take a job here first');
      p.activeUntil = w.time + 2 * productionInterval(w, b);
      result = 'Working for the next two cycles. The glamour is unbearable.';
      break;
    }
    case 'learn': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'school', 'Visit the school');
      const skill = str(a.skill);
      requireThat(skills.includes(skill), 'Unknown skill');
      requireThat(
        !p.learning && !p.skills.includes(skill) && skillFits(w, p, skill),
        'Already learning, already qualified, or skill limit reached',
      );
      const lesson = skillLesson(w, p, skill);
      requireThat(
        lesson.prerequisites.every((s) => p.skills.includes(s)),
        'Learn prerequisites first: ' + lesson.prerequisites.join(', '),
      );
      charge(w, p, lesson.price, 'tuition');
      p.learning = { skill, end: w.time + lesson.seconds };
      break;
    }
    case 'gather': {
      gather(w, p, str(a.node));
      p.task!.repeat = a.repeat === true;
      break;
    }
    case 'stopGather': {
      cancelGather(w, p);
      break;
    }
    case 'task': {
      const b = nearby(w, p, a.building);
      requireThat(b.owner !== id, 'You cannot take paid work or tasks at your own building');
      requireThat(!p.task, 'Already busy');
      const task = str(a.task);
      if (task === 'labour')
        requireThat(w.settings.jobsEnabled !== false, 'Paid jobs are disabled in this world');
      requireThat(['labour', 'logging', 'quarrying', 'craft'].includes(task), 'Unknown task');
      requireThat(
        task === 'labour'
          ? b.kind === 'workhouse'
          : task === 'logging'
            ? b.kind === 'sawmill'
            : task === 'quarrying'
              ? b.kind === 'quarry'
              : b.kind === 'forge',
        'Wrong workplace',
      );
      requireThat(
        task === 'craft' || task === 'labour',
        'Gather at the marked woodland or mineral grounds using the Resources menu',
      );
      if (task === 'craft') {
        requireThat(
          (p.inventory.steel ?? 0) >= 1 && (p.inventory.wood ?? 0) >= 2,
          'Requires 1 steel and 2 wood',
        );
        requireThat(canCarry(p, 'tools', 1, w), 'Cargo full');
        stockAdd(p.inventory, 'steel', -1);
        stockAdd(p.inventory, 'wood', -2);
      } else if (task !== 'labour')
        requireThat(canCarry(p, task === 'logging' ? 'logs' : 'stone', 3, w), 'Cargo full');
      const quote = task === 'labour' ? labourQuote(w, p) : undefined;
      const taskSeconds = task === 'labour' ? survivalRules(w.settings).labourShiftSeconds : 15;
      requireThat(!quote || quote.pay > 0, quote?.reason ?? 'This shift pays nothing');
      p.task = {
        kind: task,
        end: w.time + taskSeconds,
        building: b.id,
        ...(quote ? { reward: quote.pay, ...(quote.relief ? { relief: true } : {}) } : {}),
      };
      if (quote?.relief) p.reliefAt = w.time;
      p.speed = 0;
      result = `A bit of honest work. ${taskSeconds} seconds.`;
      break;
    }
    case 'lodging': {
      lodgingAction(w, p, nearby(w, p, a.building), a);
      break;
    }
    case 'approach': {
      const b = w.buildings.find((b) => b.id === a.building);
      requireThat(b, 'Building not found');
      approachBuilding(w, p, b);
      break;
    }
    case 'exitBuilding':
      exitBuilding(w, p);
      break;
    case 'home': {
      requireThat(p.game !== 'combat', 'Leave combat before entering a home');
      const b = nearby(w, p, a.building);
      requireThat(
        !b.construction &&
          (isLighthouseKeeper(b, p) ||
            (b.kind !== 'lighthouse' &&
              ((b.kind === 'home' && b.owner === id) ||
                (b.lodging?.guests[id]?.until ?? 0) > w.time))),
        'You need your own home or a booked room',
      );
      requireThat(!p.task && !p.hitch && !p.crowBody, 'Finish your activity first');
      if (p.inside === b.id) {
        p.home = b.id;
        p.atHome = true;
        break;
      }
      if (animatedArrival(w, p)) {
        approachBuilding(w, p, b, true);
        break;
      }
      parkAtHome(w, p, b);
      p.home = b.id;
      p.atHome = true;
      p.speed = 0;
      break;
    }
    case 'outside':
      if ((p.atHome || p.inside) && animatedArrival(w, p)) {
        exitBuilding(w, p, a.depart === 'tractor');
        break;
      }
      delete p.inside;
      if (p.atHome) leaveParkedHome(w, p, a.depart === 'tractor');
      p.atHome = false;
      if (p.task?.kind === 'homeCook') {
        delete p.task;
        result = 'Cooking cancelled because you left home. Ingredients remain in place.';
      }
      break;
    case 'loan': {
      const b = nearby(w, p, a.building);
      result = loanAction(w, p, b, a);
      break;
    }
    case 'bank': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'bank', 'Visit the bank');
      const n = num(a.amount, 1, economyRules(w.settings).cashTransferLimit, true);
      requireThat(a.direction === 'deposit' || a.direction === 'withdraw', 'Invalid direction');
      const deposit = a.direction === 'deposit';
      requireThat((deposit ? p.cash : p.bank) >= n, 'Insufficient funds');
      p.cash += deposit ? -n : n;
      p.bank += deposit ? n : -n;
      log(w, 'transfer', n, deposit ? id : id + ':bank', deposit ? id + ':bank' : id, 'bank');
      break;
    }
    case 'paint': {
      const b = nearby(w, p, a.building);
      requireThat(
        ['garage', 'boathouse'].includes(b.kind) && !b.construction,
        'Visit a completed garage or boathouse to repaint your vehicle',
      );
      const slot =
        a.slot === undefined
          ? paintableVehicle(p.vehicle)
            ? p.vehicle
            : returnTractor(p)
          : num(a.slot, 0, vehicles.length - 1, true);
      requireThat(
        paintableVehicle(slot) && (p.fleet ?? [0, 5]).includes(slot),
        'Choose a vehicle you own',
      );
      requireThat(
        b.kind !== 'boathouse' || (poweredBoat(slot, w) && !w.boatRescues?.[p.id]),
        'Recover your boat before painting it at the boathouse',
      );
      const color = str(a.color);
      requireThat(tractorPaint(color), 'Choose a paint from the garage palette');
      requireThat(vehiclePaint(p, slot) !== color, 'This vehicle already has that paint');
      charge(w, p, appearance.paintPrice, 'tractor repaint');
      migrateVehiclePaint(p);
      p.vehiclePaints = { ...p.vehiclePaints, [slot]: color };
      const parked = parkedVehicle(w, p, slot);
      if (parked) parked.paint = color;
      result = `Fresh paint for your ${vehicleDef(w, slot).name}.`;
      break;
    }
    case 'buyMap': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage' && !b.construction, 'Visit a completed garage');
      requireThat(!(p.inventory.parishMap > 0), 'You already carry a parish map');
      const price = economyRules(w.settings).mapPrintPrice;
      requireThat(p.cash >= price, 'Not enough cash');
      p.cash -= price;
      b.investment += price;
      stockAdd(p.inventory, 'parishMap', 1);
      log(w, 'transfer', price, p.id, b.id, 'map printing');
      break;
    }
    case 'serviceVehicle': {
      const b = nearby(w, p, a.building);
      requireThat(
        (b.kind === 'garage' || (b.kind === 'boathouse' && poweredBoat(p.vehicle, w))) &&
          !b.construction,
        'Visit a completed garage or boathouse',
      );
      requireThat(
        repairRecipientReady(p, w),
        'Stop an available vehicle outside below full condition',
      );
      const rules = economyRules(w.settings),
        parts = rules.vehicleServiceSteel;
      requireThat((p.inventory.steel ?? 0) >= parts, `Carry ${parts} Steel spare parts`);
      const fee = b.owner === p.id ? 0 : rules.vehicleServiceFee;
      requireThat(p.cash >= fee, 'Not enough cash');
      p.cash -= fee;
      b.investment += fee;
      if (parts > 0) stockAdd(p.inventory, 'steel', -parts);
      restoreVehicle(w, p);
      log(w, 'transfer', fee, p.id, b.id, 'vehicle service');
      break;
    }
    case 'repairVehicle': {
      const target = w.players[str(a.player)],
        status = repairStatus(w, p, target);
      requireThat(!status.reason, status.reason ?? 'Cannot repair');
      const parts = economyRules(w.settings).vehicleServiceSteel;
      if (parts > 0) stockAdd(p.inventory, 'steel', -parts);
      restoreVehicle(w, target);
      say(
        w,
        'Roadside help',
        `${p.name} repaired your vehicle using ${parts} Steel spare parts.`,
        'system',
        target.id,
      );
      say(w, 'Roadside help', `You repaired ${target.name}'s vehicle.`, 'system', p.id);
      break;
    }
    case 'vehicle': {
      const beforeVehicle = { vehicle: p.vehicle, x: p.x, y: p.y, z: p.z, heading: p.heading };
      requireThat(!p.hitch, 'Leave the passenger seat at the dock before changing vehicles');
      const slot = num(a.slot, 0, vehicles.length - 1, true);
      requireThat(
        (!isEarthmover(slot) && slot !== HIGHWAY_TRACTOR) || (p.fleet ?? []).includes(slot),
        'Buy this manufactured vehicle from an automotive factory',
      );
      const parkingBuilding = w.buildings.find((b) => b.id === a.building);
      if (persistentVehicles(w, p)) {
        requireThat(
          !p.task && !p.atHome && !p.inside && !p.crowBody && Math.abs(p.speed) < 0.5,
          'Stop outside and finish your activity before changing vehicles',
        );
        if (a.building !== undefined) nearby(w, p, a.building);
      }
      const parkingReason = parkedReturnReason(w, p, slot, parkingBuilding);
      requireThat(!parkingReason, parkingReason ?? 'Cannot board');
      const returningParked =
        (persistentVehicles(w, p) || !!parkedVehicle(w, p, slot)?.deliveryPending) &&
        !!parkedVehicle(w, p, slot);
      const garageDeparture =
        persistentVehicles(w, p) &&
        tractorGarage(parkingBuilding) &&
        isTractor(slot) &&
        (!parkedVehicle(w, p, slot) ||
          parkedVehicle(w, p, slot)?.inside === GARAGE_STORAGE ||
          parkedVehicle(w, p, slot)?.inside === parkingBuilding!.id);
      const garagePoint = garageDeparture
        ? kerbParking(w, parkingBuilding!, slot, `${p.id}:${slot}`, (point) =>
            clearParkedRig(w, `${p.id}:${slot}`, point),
          )
        : undefined;
      requireThat(
        !garageDeparture || garagePoint,
        'No safe clear parking place outside this garage',
      );
      const garageTrailers = garagePoint
        ? relocatedParkedTrailers(w, `${p.id}:${slot}`, garagePoint)
        : [];
      requireThat(
        slot !== CANOE && p.vehicle !== CANOE,
        'Use the canoe launch, board or beach controls',
      );
      requireThat(
        p.game !== 'combat' || [0, 5].includes(slot),
        'Arena combat uses tractors or walking',
      );
      requireThat(
        slot !== 7 && slot !== 6 && slot !== LIFEBOAT,
        'Use a robocrow item; ostriches happen by accident',
      );
      requireThat(!helmBlock(w, slot, p.skills), helmBlock(w, slot, p.skills) ?? '');
      const mooredOwner = slot === ROWBOAT && a.owner !== undefined ? str(a.owner) : p.id;
      const transferred =
        mooredOwner !== p.id ? w.mooredBoats?.[mooringKey(mooredOwner, slot)] : undefined;
      if (mooredOwner !== p.id) {
        requireThat(
          rowboatRules(w.settings).rowboatPublicPickup,
          'Only the owner may board this private beached rowboat',
        );
        requireThat(
          transferred?.beached && w.players[mooredOwner],
          'Choose an existing beached rowboat',
        );
        requireThat(
          !(p.fleet ?? []).includes(slot),
          'You already own a rowboat; retrieve it first',
        );
      }
      let landing: BoatLanding | undefined;
      if (poweredBoat(slot, w) || boatSlot(p.vehicle, w)) {
        requireThat(
          !p.atHome && !p.task && !p.hitch && !p.game && Math.abs(p.speed) < 0.5,
          'Stop outside and finish your activity before boarding or leaving a boat',
        );
        requireThat(!p.trawl?.deployed, 'Stow your nets before docking');
        requireThat(
          !poweredBoat(slot, w) || !boatSlot(p.vehicle, w),
          'Disembark before boarding another boat',
        );
        requireThat(slot !== p.vehicle, 'Already aboard this vehicle');
        requireThat(
          poweredBoat(slot, w) || slot === 5 || isTractor(slot),
          'Disembark on foot or into your tractor at a dock',
        );
        requireThat(
          !poweredBoat(slot, w) ||
            !w.boatRescues?.[p.id] ||
            ([TUGBOAT, MOTORBOAT].includes(slot) && w.boatRescues[p.id].boat.slot !== slot),
          'Recover your stranded boat using its lifeboat first',
        );
        const moored = w.mooredBoats?.[mooringKey(mooredOwner, slot)];
        const hull = poweredBoat(slot, w) ? slot : p.vehicle;
        const reachable = boatLandings(w, hull).filter(
          (d) =>
            (a.building === undefined ||
              d.id === a.building ||
              (!d.building &&
                !d.river &&
                !d.quay &&
                !d.beached &&
                a.building === fishingDock.id)) &&
            withinBoatLanding(w, p, d, !poweredBoat(slot, w)) &&
            (!poweredBoat(slot, w) || !moored || d.id === moored.landing),
        );
        const candidates = reachable.filter((d) => landingAccepts(w, d, hull));
        requireThat(
          candidates.length || !reachable.length,
          reachable.some((d) => d.quay)
            ? 'The vessel does not fit this quay berth; use a compatible dock'
            : `River docks take vessels up to ${boatNavigationRules(w.settings).riverDockMaxLength} m long × ${boatNavigationRules(w.settings).riverDockMaxBeam} m beam; larger vessels use a boathouse or the fishing pier`,
        );
        landing = candidates.find(
          (d) => !landingBlocked(w, d, p, poweredBoat(slot, w), slot, mooredOwner),
        );
        requireThat(
          landing,
          candidates.length
            ? landingBlocked(w, candidates[0], p, poweredBoat(slot, w), slot, mooredOwner)!
            : moored && poweredBoat(slot, w)
              ? 'Retrieve your moored boat from the pier or river dock where you left it'
              : 'Visit a completed boathouse, fishing pier or river dock: board from its land entrance, return to its water berth',
        );
        if (poweredBoat(slot, w)) {
          requireThat(
            !landing!.beached || moored?.landing === landing!.id,
            'Retrieve your moored rowboat; a stored boat cannot launch at another rower’s bank',
          );
          requireThat(
            (landing!.beached
              ? travelHeight(w, p.x, p.z) > surfaceWaterLevel(w, p.x, p.z)
              : travelHeight(w, p.x, p.z) >= waterLevel(w) + 0.15) &&
              Math.abs(p.y - travelHeight(w, p.x, p.z)) <= 2,
            'Board the boat from the shore entrance or pier deck',
          );
        } else {
          requireThat(
            !Object.values(w.players).some((q) => q.hitch === p.id),
            'Let your passengers disembark at the dock first',
          );
          requireThat(slot === 5 || (p.fleet ?? [0, 5]).includes(slot), 'Choose an owned tractor');
        }
      }
      if (slot === 2 && hasAircraftHangar(w) && !returningParked) {
        const hangar = nearby(w, p, a.building);
        requireThat(hangar.aircraftHangar, 'Visit the airfield hangar to board a biplane');
        requireThat(
          Math.abs(p.speed) < 0.5 && !p.atHome && !p.task && !p.hitch && !p.game,
          'Stop outside and finish your activity before boarding',
        );
        const x = hangar.x + Math.sin(hangar.rotation) * 17;
        const z = hangar.z + Math.cos(hangar.rotation) * 17;
        requireThat(
          !parkedFootprintBlocked(
            w,
            vehicleFootprint(w, slot, { x, z, heading: hangar.rotation + Math.PI / 2 }),
          ),
          'The aircraft apron is occupied by a parked vehicle',
        );
        requireThat(
          !Object.values(w.players).some(
            (q) => q.id !== p.id && q.online && !q.atHome && Math.hypot(q.x - x, q.z - z) < 10,
          ),
          'The aircraft apron is occupied; wait for it to clear',
        );
        requireThat(
          !w.buildings.some((b) => buildingBlocksMovement(b, { x, z }, { x, z }, 0, 6)),
          'The aircraft apron is blocked',
        );
      }
      const cargoReason = cargoFitReason(w, p, slot);
      requireThat(!cargoReason, cargoReason ?? '');
      let fleet = p.fleet ?? [0, 5];
      if (transferred) {
        const old = w.players[mooredOwner];
        old.fleet = (old.fleet ?? [0, 5]).filter((s) => s !== slot);
        fleet = [...fleet, slot];
        for (const key of ['fleetState', 'vehiclePaints', 'parkedFuel'] as const) {
          const record = old[key]?.[slot];
          if (record !== undefined) {
            Object.assign(p, { [key]: { ...p[key], [slot]: record } });
            delete old[key]![slot];
          }
        }
        w.mooredBoats![mooringKey(p.id, slot)] = { ...transferred, owner: p.id };
        delete w.mooredBoats![mooringKey(mooredOwner, slot)];
      }
      if (
        !returningParked &&
        slot !== 5 &&
        slot !== 0 &&
        !(isTractor(slot) && fleet.includes(slot))
      ) {
        const b = poweredBoat(slot, w) ? landing!.building : nearby(w, p, a.building);
        requireThat(
          poweredBoat(slot, w)
            ? !!landing
            : b!.kind === 'garage' &&
                (slot === 2 ? !hasAircraftHangar(w) || b!.aircraftHangar : !b!.aircraftHangar),
          slot === 2 ? 'Visit the airfield hangar' : 'Visit the garage',
        );
        if (slot === 2) {
          commissionBiplane(p);
          fleet = p.fleet ?? fleet;
        }
        if (!fleet.includes(slot)) {
          requireThat(
            !poweredBoat(slot, w) ||
              !!landing?.building ||
              (slot === ROWBOAT && !landing?.river && !landing?.quay && !landing?.beached),
            'Buy your first boat at a boathouse',
          );
          requireThat(
            slot !== ROWBOAT || rowboatRules(w.settings).rowboatsEnabled,
            'New rowboat purchases are disabled in this world',
          );
          const price = vehicleDef(w, slot).price;
          if (slot === 2 && b!.aircraftHangar) {
            requireThat(p.cash >= price, 'Not enough cash');
            p.cash -= price;
            b!.investment += price;
            log(w, 'transfer', price, p.id, b!.id, 'vehicle purchase');
          } else charge(w, p, price, 'vehicle purchase');
          migrateVehiclePaint(p);
          fleet.push(slot);
        }
      }
      if (landing && p.vehicle === LIFEBOAT) {
        const r = w.boatRescues?.[p.id];
        // A rescued deckhand has a lifeboat but no owned stranded vessel.
        if (r)
          r.dinghy = {
            ...landing.berth,
            heading: landing.heading,
            moored: true,
            landing: landing.id,
          };
      } else if (
        landing &&
        poweredBoat(p.vehicle, w) &&
        (!landing.building || vehicleDef(w, p.vehicle).holdCapacity)
      ) {
        w.mooredBoats ??= {};
        w.mooredBoats[mooringKey(p.id, p.vehicle)] = {
          owner: p.id,
          slot: p.vehicle,
          ...landing.berth,
          heading: landing.heading,
          paint: vehiclePaint(p) ?? (p.vehicle === ROWBOAT ? '' : 'blue'),
          landing: landing.id,
          ...(landing.beached ? { beached: landing.land } : {}),
          ...(vehicleDef(w, p.vehicle).holdCapacity
            ? { cargo: p.boatHold ?? {}, cargoBasis: p.boatHoldBasis, cargoLife: p.boatHoldLife }
            : {}),
        };
        delete p.boatHold;
        delete p.boatHoldLife;
        delete p.boatHoldBasis;
      } else if (landing && w.mooredBoats) {
        if (vehicleDef(w, slot).holdCapacity) {
          p.boatHold = w.mooredBoats[mooringKey(p.id, slot)]?.cargo ?? {};
          p.boatHoldLife = w.mooredBoats[mooringKey(p.id, slot)]?.cargoLife;
          p.boatHoldBasis = w.mooredBoats[mooringKey(p.id, slot)]?.cargoBasis;
        }
        delete w.mooredBoats[mooringKey(p.id, poweredBoat(slot, w) ? slot : p.vehicle)];
      }
      if (landing?.building && poweredBoat(p.vehicle, w) && !vehicleDef(w, p.vehicle).holdCapacity)
        vehicleRecord(w, p).storedAt = landing.building.id;
      if (poweredBoat(slot, w)) delete vehicleRecord(w, p, slot).storedAt;
      p.fleet = fleet;
      if (
        garageDeparture &&
        p.homeParking?.building === parkingBuilding!.id &&
        p.homeParking.slot !== slot
      ) {
        const previous = parkedVehicle(w, p, p.homeParking.slot);
        if (
          previous &&
          !previous.inside &&
          Math.hypot(previous.x - parkingBuilding!.x, previous.z - parkingBuilding!.z) <=
            parkingRules(w.settings).parkingSearchRange + parkingRules(w.settings).arrivalRange
        )
          previous.inside = parkingBuilding!.id;
      }
      switchPersistentVehicle(w, p, slot, parkingBuilding);
      vehicleRecord(w, p);
      if (garagePoint) Object.assign(p, garagePoint);
      for (const t of garageTrailers) {
        Object.assign(w.trailers![t.id], t);
        delete w.trailers![t.id].parkedWith;
      }
      p.speed = 0;
      if (
        slot === 2 &&
        !returningParked &&
        w.buildings.find((b) => b.id === a.building)?.aircraftHangar
      ) {
        const b = w.buildings.find((b) => b.id === a.building)!;
        p.x = b.x + Math.sin(b.rotation) * 17;
        p.z = b.z + Math.cos(b.rotation) * 17;
        // Park parallel to the runway; the chase camera stays outside the hangar.
        p.heading = b.rotation + Math.PI / 2;
        p.engine = false;
        delete p.flight;
      }
      if (landing) {
        p.boatThrottle = 0;
        Object.assign(p, poweredBoat(slot, w) ? landing.berth : landing.land);
        p.heading = poweredBoat(slot, w)
          ? landing.heading
          : (landing.building?.rotation ?? Math.PI);
        p.engine = false;
      }
      p.y = poweredBoat(slot, w) ? surfaceWaterLevel(w, p.x, p.z) : travelHeight(w, p.x, p.z);
      beginVehicleMount(w, p, beforeVehicle);
      break;
    }
    case 'engine':
      requireThat(hasMotor(w, p.vehicle), 'This vehicle has no motor');
      if (p.engine && onSolidGround(w, p)) {
        const reason = parkingBlocker(w, p);
        requireThat(!reason, reason ?? 'Keep this route clear');
      }
      p.engine = !p.engine;
      break;
    case 'boatLights':
      changeBoatLighting(p, a.circuit, w);
      break;
    case 'earthwork':
      return earthworkAction(w, p, a);
    case 'earthmovingImplement':
      requireThat(isEarthmover(p.vehicle), 'Board an earthmoving machine first');
      requireThat(
        !p.task && !p.game && !p.hitch && !p.atHome && !p.inside,
        'Finish your activity and go outside first',
      );
      requireThat(!helmBlock(w, p.vehicle, p.skills), helmBlock(w, p.vehicle, p.skills) ?? '');
      p.earthmovingImplement = !p.earthmovingImplement;
      break;
    case 'lights':
      p.lights = !p.lights;
      break;
    case 'crowAbility':
      return crowAbility(w, p, str(a.operation));
    case 'crow': {
      requireThat(p.game !== 'combat', 'Leave combat before flying a robocrow');
      if (p.crowBody) {
        returnCrow(w, p);
      } else {
        requireThat(
          !p.task && !p.game && !p.hitch && !p.atHome,
          'Finish your activity and go outside first',
        );
        const crowClass = str(a.class ?? 'scout') as CrowClass;
        requireThat(Object.hasOwn(crowClasses, crowClass), 'Unknown robocrow class');
        requireThat(
          crowClass === 'scout' || (w.settings.crowAbilities && w.settings.fighting),
          'Advanced robocrows are disabled',
        );
        requireThat((p.inventory.rc ?? 0) > 0, 'Carry a Disposable robocrow');
        if (w.settings.crowAbilities && w.settings.fighting) {
          p.crowClass = crowClass;
          p.crowIntegrity = crowClasses[crowClass].integrity;
        }
        stockAdd(p.inventory, 'rc', -1);
        p.crowBody = { x: p.x, z: p.z, vehicle: p.vehicle };
        p.vehicle = 7;
        p.y += 8;
      }
      p.speed = 0;
      break;
    }
    case 'joinGame': {
      const game = str(a.game);
      requireThat(['hornball', 'race', 'fishing', 'kricket'].includes(game), 'Unknown game');
      requireThat(!p.task && p.game !== 'combat', 'Finish your task or leave combat first');
      if (game === 'fishing') {
        requireThat(!p.trawl?.deployed, 'Stow the trawl net before rod fishing');
        requireThat((p.inventory.tackle ?? 0) > 0, 'Carry Fishing tackle');
        requireThat(w.settings.fishingMode !== 0, 'Fishing is disabled');
        requireThat(
          (!p.hitch || !!charterCaptain(w, p)) &&
            !p.atHome &&
            !p.crowBody &&
            Math.abs((fishingVessel(w, p) ?? p).speed) < 0.5,
          'Stop outside before fishing',
        );
        if (fishingVessel(w, p))
          requireThat(
            terrainHeight(w, p.x, p.z) < surfaceWaterLevel(w, p.x, p.z) - 0.65,
            'Take the boat into water before fishing',
          );
      }
      if (game === 'kricket') requireThat(!w.kricket.bowler || !w.kricket.batter, 'Pitch is full');
      p.game = game;
      p.atHome = false;
      if (game === 'hornball') {
        const joined = Object.values(w.players).filter((p) => p.game === 'hornball' && p.id !== id);
        p.team =
          joined.filter((p) => p.team === 0).length <= joined.filter((p) => p.team === 1).length
            ? 0
            : 1;
        p.x = p.team ? 102 : 78;
        p.z = 45 + ((joined.length % 3) - 1) * 5;
        p.heading = p.team ? -Math.PI / 2 : Math.PI / 2;
        switchVehicle(p, 0, false, w);
      }
      if (game === 'race') {
        p.x = -75;
        p.z = -20;
        switchVehicle(p, 0, false, w);
        p.race = { start: w.time + 3, next: 1 };
        p.heading = -Math.PI / 4;
      }
      if (game === 'fishing') {
        requireThat((p.inventory.tackle ?? 0) > 0, 'Carry Fishing tackle');
        requireThat(w.settings.fishingMode !== 0, 'Fishing is disabled');
        if (!fishingVessel(w, p)) {
          p.x = fishingDock.x;
          p.z = fishingDock.z + 2;
          p.y = travelHeight(w, p.x, p.z);
        } else p.y = surfaceWaterLevel(w, p.x, p.z);
        p.engine = false;
        scheduleBite(w, p);
      }
      if (game === 'kricket') {
        requireThat(!w.kricket.bowler || !w.kricket.batter, 'Pitch is full');
        if (!w.kricket.bowler) w.kricket.bowler = id;
        else w.kricket.batter = id;
        p.x = 70;
        p.z = -70;
        p.vehicle = 5;
      }
      p.speed = 0;
      break;
    }
    case 'leaveGame': {
      leaveCombat(w, p);
      delete p.game;
      delete p.race;
      delete p.fishCatch;
      delete p.fishAt;
      delete p.fishUntil;
      if (w.kricket.batter === id) delete w.kricket.batter;
      if (w.kricket.bowler === id) delete w.kricket.bowler;
      break;
    }
    case 'horn': {
      requireThat(w.time - p.lastHorn >= 0.35, 'Let the horn breathe');
      p.lastHorn = w.time;
      if (p.game === 'hornball' && distance(p, w.ball) < 22) {
        const d = Math.max(1, distance(p, w.ball));
        w.ball.vx += ((w.ball.x - p.x) / d) * 17;
        w.ball.vz += ((w.ball.z - p.z) / d) * 17;
      }
      result = 'Parp.';
      break;
    }
    case 'reel': {
      requireThat(
        !p.charterPassage || (charterCaptain(w, p) && Math.abs(charterCaptain(w, p)!.speed) < 0.5),
        'Wait for the boat to stop before fishing',
      );
      requireThat(p.game === 'fishing' && p.fishAt !== undefined, 'Cast a line first');
      requireThat(
        w.time >= p.fishAt && w.time <= (p.fishUntil ?? 0),
        'No bite yet, or that one got away',
      );
      const catchId = landedFish(w, p);
      requireThat(
        canCarry(p, catchId, 1, w),
        'Cargo full for this catch; free some space before reeling',
      );
      stockAdd(p.inventory, catchId, 1);
      recordGathered(w, p, catchId, 1);
      if (p.fishingVoyage)
        p.fishingVoyage.caught[catchId] = (p.fishingVoyage.caught[catchId] ?? 0) + 1;
      p.kudos++;
      scheduleBite(w, p);
      result = 'Caught ' + items[catchId].name + '.';
      break;
    }
    case 'kricket': {
      requireThat(p.game === 'kricket', 'Join Ultrakricket first');
      if (w.kricket.bowler === id) {
        requireThat(!w.kricket.due, 'The grenade is already in flight');
        w.kricket.due = w.time + 3;
        result = 'Bowled. Three seconds ought to do it.';
      } else {
        requireThat(w.kricket.batter === id && w.kricket.due > 0, 'Wait for a delivery');
        const good = Math.abs(w.time - w.kricket.due) < 0.65;
        w.kricket.score[id] = (w.kricket.score[id] ?? 0) + (good ? 6 : 0);
        if (!good) kill(w, p, true);
        else p.kudos += 2;
        w.kricket.due = 0;
        result = good ? 'Six! An entirely regulation explosion.' : 'A duck. Almost literally.';
      }
      break;
    }
    case 'joinCombat':
      joinCombat(w, p, str(a.mode));
      break;
    case 'chargeWeapon':
    case 'fire':
      fireWeapon(w, p, a);
      break;
    case 'refit': {
      const b = nearby(w, p, a.building);
      requireThat(b.kind === 'garage', 'Visit the garage');
      requireThat(w.time - p.lastShot >= 10, 'Wait ten seconds after firing');
      charge(w, p, economyRules(w.settings).ammunitionRefitPrice, 'ammunition refit');
      p.ammo = { ...ammunition };
      p.energy = 65000;
      break;
    }
    case 'bridge': {
      result = bridgeAction(w, p, a, (cash, reason) => charge(w, p, cash, reason));
      break;
    }
    case 'construct': {
      const requested = str(a.kind),
        kind = w.catalogue?.templates[requested]?.base ?? requested,
        def = worldBuildings(w)[requested];
      const site =
        ['waterworks', 'boathouse', 'pumpHouse'].includes(kind) &&
        (a.x !== undefined || a.z !== undefined)
          ? { x: num(a.x, -mapHalf(w), mapHalf(w)), z: num(a.z, -mapHalf(w), mapHalf(w)) }
          : { x: p.x, z: p.z };
      const construction = constructionRules(w.settings);
      requireThat(
        distance(p, site) <= construction.constructionPlacementReach,
        `Move within ${construction.constructionPlacementReach} metres of the construction site`,
      );
      const architecture = a.architecture === undefined ? undefined : str(a.architecture);
      const style = a.style === undefined ? undefined : str(a.style);
      const size = a.size === undefined ? undefined : str(a.size);
      const chosenRotation =
        a.rotation === undefined ? undefined : num(a.rotation, -Math.PI * 2, Math.PI * 2);
      requireThat(def, 'Unknown building type');
      requireThat(
        kind !== 'automotiveFactory' || automotiveConfig(w).enabled,
        'Automotive manufacturing is disabled in this world',
      );
      requireThat(
        kind !== 'butcher' || meatRules(w.settings).butchersEnabled,
        'Butchers are disabled in this world',
      );
      const customModel = w.catalogue?.templates[requested]?.creatorModel;
      requireThat(
        !customModel ||
          (architecture === undefined && style === undefined && (!size || size === 'standard')),
        'Custom models use their creator-defined design',
      );
      const design = buildingDesignQuote(kind, def, style, size, architecture, w.settings);
      requireThat(def && def.tier <= w.tier, 'Building unavailable at this civilization tier');
      requireThat(
        !w.zones.some((z) => z.kind === 'noBuild' && distance(site, z) < z.radius),
        'Construction prohibited in this zone',
      );
      requireThat(
        w.buildings.every((b) => distance(site, b) > construction.constructionMinimumSpacing),
        'Too close to another building',
      );
      const model = customModel ? w.creator?.models.find((m) => m.id === customModel) : undefined;
      const creatorBounds = model
        ? { width: model.width, depth: model.depth, height: model.height }
        : undefined;
      const footprint = buildingBounds(
        buildingPlan({ id: 'construction', kind, style, size, architecture, creatorBounds }),
      );
      requireThat(
        !onFarmLand(w, site.x, site.z, Math.max(footprint.width, footprint.depth) / 2),
        'Construction would cover farmland',
      );
      const pump =
        kind === 'pumpHouse'
          ? pumpHouseSite(w, {
              id: 'construction',
              kind,
              ...site,
              rotation: chosenRotation ?? 0,
              architecture,
              style,
              size: size as BuildingSize | undefined,
              creatorBounds,
            })
          : undefined;
      requireThat(kind !== 'pumpHouse' || pump, freshWaterReason);
      if (pump) {
        Object.assign(site, { x: pump.x, z: pump.z });
        requireThat(
          distance(p, site) <= construction.constructionPlacementReach,
          `Move within ${construction.constructionPlacementReach} metres of the snapped construction site`,
        );
        requireThat(
          w.buildings.every((b) => distance(site, b) > construction.constructionMinimumSpacing),
          'Too close to another building',
        );
      }
      const shore =
        kind === 'waterworks' ? waterworksSite(w, site, chosenRotation, true) : undefined;
      requireThat(
        kind !== 'waterworks' || shore,
        'Desalination plants require dry ground on an ocean shoreline with a sea-water intake',
      );
      const rotation = chosenRotation ?? shore?.rotation ?? 0;
      const siteReason = constructionSiteReason(
        w,
        {
          id: 'construction',
          kind,
          style,
          architecture,
          size: size as BuildingSize | undefined,
          x: site.x,
          z: site.z,
          rotation,
          creatorBounds,
        },
        p,
      );
      requireThat(!siteReason, siteReason!);
      const home = ['home', 'warehouse'].includes(kind);
      requireThat(
        w.buildings.filter(
          (b) =>
            (b.owner === id || b.operatingLease?.landlord === id) &&
            (home
              ? ['home', 'warehouse'].includes(b.kind)
              : !['home', 'warehouse'].includes(b.kind)),
        ).length < (home ? w.settings.maxHomes : w.settings.maxBuildings),
        'Property limit reached',
      );
      const terms = constructionTerms(w, p, requested, site, design.price);
      requireThat(p.cash >= design.price + terms.tax, 'Not enough cash');
      charge(w, p, design.price, 'construction');
      if (terms.town) {
        p.cash -= terms.tax;
        payTown(w, terms.town, p.id, terms.tax, 'construction tax');
      }
      growTown(w, site);
      const b = makeBuilding('b' + ++w.revision + '-' + Math.floor(w.time), kind, site.x, site.z);
      applyBuildingTemplate(w, b, requested);
      b.owner = id;
      if (pump) b.waterSource = pump.waterSource;
      b.rotation = rotation;
      if (size) b.size = size as BuildingSize;
      b.capacity = design.capacity;
      b.price = design.price;
      if (style) b.style = style;
      if (architecture) b.architecture = architecture;
      b.investment = 0;
      b.stock = {};
      b.construction = { ...design.materials };
      b.constructionCost = design.price;
      b.foundationY = foundationProfile(w, b).level;
      w.buildings.push(b);
      refreshPumpRecipes(w);
      result = 'Construction site placed. Deliver the materials listed at the site.';
      break;
    }
    case 'cancelConstruction': {
      const b = w.buildings.find((b) => b.id === a.building);
      requireThat(b && b.construction, 'Choose an unfinished construction site');
      requireThat(b.owner === p.id, 'Only the building owner can cancel construction');
      requireThat(distance(p, b) < 18, 'Drive near the construction site first');
      requireThat(!b.government && !b.lien, 'This property cannot be cancelled');
      const refund = constructionRefund(w, b);
      w.buildings = w.buildings.filter((site) => site !== b);
      if (w.creator) w.creator.rules = w.creator.rules.filter((r) => r.target !== b.id);
      grant(w, p, refund, 'Construction refund: ' + b.name);
      result =
        'Construction cancelled. Refunded ' + money(refund, w.settings.denariiPerSheckle) + '.';
      break;
    }
    case 'supply': {
      const b = w.buildings.find((b) => b.id === a.building);
      requireThat(b && distance(p, b) < 18 && b.construction, 'No nearby construction site');
      for (const [item, n] of Object.entries(b.construction)) {
        const take = Math.min(n, p.inventory[item] ?? 0);
        stockAdd(p.inventory, item, -take);
        b.construction[item] -= take;
      }
      if (Object.values(b.construction).every((n) => !n)) {
        delete b.construction;
        delete b.constructionCost;
        const builder = b.owner ? w.players[b.owner] : undefined;
        if (builder) playerStatistics(w, builder).buildingsCompleted++;
        questEvent(w, p, 'build', b.templateId ?? b.kind);
        queueCreatorScript(w, 'BuildingComplete', { id, building: b.id, kind: b.kind });
        result = 'Building complete. Civilisation marches on.';
      }
      break;
    }
    case 'repair': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      charge(w, p, Math.round((b.price * (100 - b.condition)) / 100), 'repairs');
      b.condition = 100;
      break;
    }
    case 'demolish': {
      const b = nearby(w, p, a.building);
      owns(p, b);
      requireThat(!b.government, 'Government buildings cannot be demolished');
      requireThat(
        !garageOccupied(w, b.id),
        'Retrieve stored vehicles and trailers before demolishing this garage',
      );
      requireThat(
        !b.manufacturing?.orders.length && !b.manufacturing?.ready.length,
        'Finish or cancel assembly orders and deliver manufactured vehicles before demolition',
      );
      requireThat(!b.lien, 'Repay the mortgage before demolishing this property');
      requireThat(
        !Object.values(w.players).some((p) =>
          p.loans?.some((l) => l.bank === b.id && l.status !== 'paid'),
        ),
        'Outstanding loans must be settled before demolishing this bank',
      );
      requireThat(
        !Object.values(b.lodging?.guests ?? {}).some(
          (g) => g.until > w.time || Object.values(g.stock).some((n) => n > 0),
        ),
        'Guests must check out and collect their supplies first',
      );
      refundStakes(w, b);
      w.buildings = w.buildings.filter((x) => x !== b);
      if (w.creator) w.creator.rules = w.creator.rules.filter((r) => r.target !== b.id);
      break;
    }
    case 'settings': {
      owner(p);
      const patch = a.patch;
      requireThat(patch && typeof patch === 'object' && !Array.isArray(patch), 'Invalid settings');
      const clean: Partial<Settings> = {};
      for (const [key, v] of Object.entries(patch)) {
        requireThat(
          Object.hasOwn(w.settings, key) ||
            obstacleRuleKeys.includes(key) ||
            Object.hasOwn(climateRuleFields, key) ||
            Object.hasOwn(alpineRuleFields, key) ||
            Object.hasOwn(calendarRuleFields, key) ||
            Object.hasOwn(landscapeRuleFields, key) ||
            Object.hasOwn(communicationRuleFields, key) ||
            Object.hasOwn(flightRuleFields, key) ||
            Object.hasOwn(walkingRuleFields, key) ||
            Object.hasOwn(gatheringSceneryFields, key) ||
            Object.hasOwn(fuelRuleFields, key) ||
            Object.hasOwn(canoeRuleFields, key) ||
            Object.hasOwn(rowboatRuleFields, key) ||
            Object.hasOwn(stormRuleFields, key) ||
            Object.hasOwn(waterSourceRuleFields, key) ||
            Object.hasOwn(livestockRuleFields, key) ||
            Object.hasOwn(meatRuleFields, key) ||
            Object.hasOwn(buildingDoorFields, key) ||
            Object.hasOwn(parkingFields, key) ||
            Object.hasOwn(nameTagFields, key) ||
            Object.hasOwn(roadRuleFields, key) ||
            Object.hasOwn(bridgeRuleFields, key) ||
            Object.hasOwn(radioRuleFields, key) ||
            Object.hasOwn(survivalRuleFields, key) ||
            Object.hasOwn(economyRuleFields, key) ||
            Object.hasOwn(loanRuleFields, key) ||
            Object.hasOwn(creditRuleFields, key) ||
            Object.hasOwn(charterRuleFields, key) ||
            Object.hasOwn(towingRuleFields, key) ||
            Object.hasOwn(npcHouseholdRuleFields, key) ||
            Object.hasOwn(npcReserveRuleFields, key) ||
            Object.hasOwn(npcBusinessRuleFields, key) ||
            Object.hasOwn(npcPricingRuleFields, key) ||
            Object.hasOwn(npcCargoRuleFields, key) ||
            Object.hasOwn(npcAccountRuleFields, key) ||
            Object.hasOwn(constructionRuleFields, key) ||
            Object.hasOwn(gatheringRuleFields, key) ||
            Object.hasOwn(farmYieldRuleFields, key) ||
            Object.hasOwn(fishingRuleFields, key) ||
            Object.hasOwn(vehicleRunningRuleFields, key) ||
            Object.hasOwn(boatNavigationRuleFields, key) ||
            Object.hasOwn(gatheringImplementFields, key) ||
            Object.hasOwn(npcJourneyRuleFields, key) ||
            Object.hasOwn(npcBusinessLoadRuleFields, key) ||
            key === 'loanTerms',
          'Unknown setting',
        );
        const npcBusinessLoadField =
          npcBusinessLoadRuleFields[key as keyof typeof npcBusinessLoadRuleFields];
        const npcJourneyField = npcJourneyRuleFields[key as keyof typeof npcJourneyRuleFields];
        const communicationField =
          communicationRuleFields[key as keyof typeof communicationRuleFields];
        const calendarField = calendarRuleFields[key as keyof typeof calendarRuleFields];
        const landscapeField = landscapeRuleFields[key as keyof typeof landscapeRuleFields];
        const alpineField = alpineRuleFields[key as keyof typeof alpineRuleFields];
        const climateField = climateRuleFields[key as keyof typeof climateRuleFields];
        const vehicleRunningField =
          vehicleRunningRuleFields[key as keyof typeof vehicleRunningRuleFields];
        const boatNavigationField =
          boatNavigationRuleFields[key as keyof typeof boatNavigationRuleFields];
        const fishingField = fishingRuleFields[key as keyof typeof fishingRuleFields];
        const farmYieldField = farmYieldRuleFields[key as keyof typeof farmYieldRuleFields];
        const gatheringRateField = gatheringRuleFields[key as keyof typeof gatheringRuleFields];
        const constructionSpec = constructionRuleFields[key as keyof typeof constructionRuleFields];
        const constructionField =
          constructionSpec && 'min' in constructionSpec ? constructionSpec : undefined;
        const npcAccountField = npcAccountRuleFields[key as keyof typeof npcAccountRuleFields];
        const npcCargoField = npcCargoRuleFields[key as keyof typeof npcCargoRuleFields];
        const economyField = economyRuleFields[key as keyof typeof economyRuleFields];
        const loanField = loanRuleFields[key as keyof typeof loanRuleFields];
        const creditField = creditRuleFields[key as keyof typeof creditRuleFields];
        const npcPricingField = npcPricingRuleFields[key as keyof typeof npcPricingRuleFields];
        const npcBusinessField = npcBusinessRuleFields[key as keyof typeof npcBusinessRuleFields];
        const npcReserveField = npcReserveRuleFields[key as keyof typeof npcReserveRuleFields];
        const npcHouseholdField =
          npcHouseholdRuleFields[key as keyof typeof npcHouseholdRuleFields];
        const towingField = towingRuleFields[key as keyof typeof towingRuleFields];
        const charterField = charterRuleFields[key as keyof typeof charterRuleFields];
        const obstacleField = obstacleRuleFields[key as keyof typeof obstacleRuleFields];
        if (obstacleField) {
          num(v, obstacleField.min, obstacleField.max);
          if (obstacleField.step === 1) requireThat(Number.isInteger(v), 'Use a whole number');
        }
        const nameTagField = nameTagFields[key as keyof typeof nameTagFields];
        if (nameTagField && 'min' in nameTagField)
          num(v, nameTagField.min, nameTagField.max, nameTagField.step === 1);
        const bridgeField = bridgeRuleFields[key as keyof typeof bridgeRuleFields];
        if (bridgeField && 'min' in bridgeField)
          num(v, bridgeField.min, bridgeField.max, bridgeField.step === 1);
        const roadField = roadRuleFields[key as keyof typeof roadRuleFields];
        if (roadField && 'min' in roadField)
          num(v, roadField.min, roadField.max, key.startsWith('city') && roadField.step === 1);
        const parkingField = parkingFields[key as keyof typeof parkingFields];
        if (parkingField && 'min' in parkingField)
          num(v, parkingField.min, parkingField.max, parkingField.step === 1);
        const doorField = buildingDoorFields[key as keyof typeof buildingDoorFields];
        if (doorField && 'min' in doorField)
          num(v, doorField.min, doorField.max, doorField.step === 1);
        const old = w.settings[key as keyof Settings] ?? defaults[key as keyof Settings];
        if (typeof old === 'boolean') requireThat(typeof v === 'boolean', 'Expected boolean');
        else if (parkingField && 'choices' in parkingField)
          requireThat(
            (parkingField.choices as readonly unknown[]).includes(v),
            'Choose a valid arrival animation policy',
          );
        else if (doorField && 'choices' in doorField)
          requireThat(
            (doorField.choices as readonly unknown[]).includes(v),
            'Choose a valid building door or interior policy',
          );
        else if (key === 'solidScenery')
          requireThat(
            solidSceneryModes.includes(v as any),
            'Choose off, trunks, or trunks-and-boulders',
          );
        else if (key === 'vehicleCollision')
          requireThat(
            vehicleCollisionModes.includes(v as any),
            'Choose off, stop-only, or glancing',
          );
        else if (key === 'loanTerms')
          requireThat(
            validLoanTerms(v),
            'Choose ascending unique loan terms from 1 to 120 months, separated by commas',
          );
        else if (Object.hasOwn(gatheringImplementFields, key))
          requireThat(
            gatheringImplementChoices.includes(v as (typeof gatheringImplementChoices)[number]),
            'Choose none, chainsaw, pickaxe or shovel',
          );
        else if (key === 'gatheringScenery')
          requireThat(
            gatheringSceneryModes.includes(v as (typeof gatheringSceneryModes)[number]),
            'Choose natural, worked-near-settlements or always-worked',
          );
        else if (key === 'weaponMode')
          requireThat(
            typeof v === 'string' && ['energy', 'ammo'].includes(v),
            'Choose energy or ammo',
          );
        else
          num(
            v,
            key === 'seaLevel' || key === 'flightLandingPitchMin'
              ? -50
              : (constructionField?.min ?? 0),
            npcBusinessLoadField?.max ??
              npcJourneyField?.max ??
              npcAccountField?.max ??
              constructionField?.max ??
              gatheringRateField?.max ??
              farmYieldField?.max ??
              fishingField?.max ??
              npcCargoField?.max ??
              npcPricingField?.max ??
              npcBusinessField?.max ??
              npcReserveField?.max ??
              npcHouseholdField?.max ??
              towingField?.max ??
              charterField?.max ??
              creditField?.max ??
              economyField?.max ??
              loanField?.max ??
              (key === 'startingCash' ? 1e8 : 1e6),
          );
        if (npcBusinessLoadField) num(v, npcBusinessLoadField.min, npcBusinessLoadField.max, true);
        if (npcJourneyField)
          num(v, npcJourneyField.min, npcJourneyField.max, npcJourneyField.step === 1);
        if (gatheringRateField) num(v, gatheringRateField.min, gatheringRateField.max, true);
        if (communicationField)
          num(v, communicationField.min, communicationField.max, communicationField.step === 1);
        if (calendarField) num(v, calendarField.min, calendarField.max, calendarField.step === 1);
        if (landscapeField) num(v, landscapeField.min, landscapeField.max, true);
        if (alpineField && 'min' in alpineField) num(v, alpineField.min, alpineField.max);
        if (climateField) num(v, climateField.min, climateField.max);
        if (vehicleRunningField && 'min' in vehicleRunningField)
          num(v, vehicleRunningField.min, vehicleRunningField.max);
        if (boatNavigationField) num(v, boatNavigationField.min, boatNavigationField.max);
        if (fishingField) num(v, fishingField.min, fishingField.max, fishingField.step === 1);
        if (farmYieldField)
          num(v, farmYieldField.min, farmYieldField.max, farmYieldField.step === 1);
        if (constructionField)
          num(v, constructionField.min, constructionField.max, constructionField.step === 1);
        if (key === 'maximumFarmPlots')
          requireThat(validFarmPlotCount(v), 'Choose a farm plot limit in multiples of four');
        if (npcAccountField) num(v, npcAccountField.min, npcAccountField.max, true);
        if (npcCargoField) num(v, npcCargoField.min, npcCargoField.max, true);
        if (economyField) num(v, economyField.min, economyField.max, economyField.step === 1);
        if (creditField) num(v, creditField.min, creditField.max, true);
        if (charterField) num(v, charterField.min, charterField.max, true);
        if (towingField) num(v, towingField.min, towingField.max, true);
        if (npcPricingField)
          num(v, npcPricingField.min, npcPricingField.max, npcPricingField.step === 1);
        if (npcBusinessField)
          num(v, npcBusinessField.min, npcBusinessField.max, npcBusinessField.step === 1);
        if (npcReserveField)
          num(v, npcReserveField.min, npcReserveField.max, npcReserveField.step === 1);
        if (npcHouseholdField)
          num(v, npcHouseholdField.min, npcHouseholdField.max, npcHouseholdField.step === 1);
        if (loanField) num(v, loanField.min, loanField.max, loanField.step === 1);
        const survivalField = survivalRuleFields[key as keyof typeof survivalRuleFields];
        if (survivalField && 'min' in survivalField)
          num(v, survivalField.min, survivalField.max, survivalField.step === 1);
        const radioField = radioRuleFields[key as keyof typeof radioRuleFields];
        if (radioField && 'min' in radioField)
          num(v, radioField.min, radioField.max, radioField.step === 1);
        const livestockField = livestockRuleFields[key as keyof typeof livestockRuleFields];
        if (livestockField && 'min' in livestockField)
          num(v, livestockField.min, livestockField.max, livestockField.step === 1);
        const meatField = meatRuleFields[key as keyof typeof meatRuleFields];
        if (meatField && 'min' in meatField)
          num(v, meatField.min, meatField.max, meatField.step === 1);
        const waterField = waterSourceRuleFields[key as keyof typeof waterSourceRuleFields];
        if (waterField && 'min' in waterField)
          num(v, waterField.min, waterField.max, waterField.step === 1);
        const stormField = stormRuleFields[key as keyof typeof stormRuleFields];
        if (stormField && 'min' in stormField)
          num(v, stormField.min, stormField.max, stormField.step === 1);
        const rowboatField = rowboatRuleFields[key as keyof typeof rowboatRuleFields];
        if (rowboatField && 'min' in rowboatField) num(v, rowboatField.min, rowboatField.max);
        const canoeField = canoeRuleFields[key as keyof typeof canoeRuleFields];
        if (canoeField && 'min' in canoeField)
          num(v, canoeField.min, canoeField.max, canoeField.step === 1);
        const fuelField = fuelRuleFields[key as keyof typeof fuelRuleFields];
        if (fuelField && 'min' in fuelField)
          num(v, fuelField.min, fuelField.max, fuelField.step === 1);
        const walkingField = walkingRuleFields[key as keyof typeof walkingRuleFields];
        const gatheringField = gatheringSceneryFields[key as keyof typeof gatheringSceneryFields];
        if (gatheringField && 'min' in gatheringField)
          num(v, gatheringField.min, gatheringField.max);
        if (walkingField && 'min' in walkingField) num(v, walkingField.min, walkingField.max);
        const flightField = flightRuleFields[key as keyof typeof flightRuleFields];
        if (flightField && 'min' in flightField) num(v, flightField.min, flightField.max);
        if (
          [
            'salesTax',
            'wageTax',
            'offlineEfficiency',
            'estateEquityShare',
            'estateAnnualDiscount',
            'deathCashRetention',
            'deathBankRetention',
          ].includes(key)
        )
          num(v, 0, 1);
        if (['denariiPerSheckle', 'productionSeconds', 'maxAge', 'exchangeRate'].includes(key))
          num(v, 1, 1e6);
        if (
          [
            'parishOrderBudget',
            'startingCash',
            'denariiPerSheckle',
            'maxBuildings',
            'maxHomes',
            'maxSkills',
            'importCap',
            'exchangeRate',
            'exchangeCap',
          ].includes(key)
        )
          num(v, 0, 100000000, true);
        if (key === 'homeNeedsMultiplier') num(v, 0, 1);
        if (key === 'labourShiftPay' || key === 'labourDailyCap') num(v, 0, 1e6, true);
        if (key === 'boatCargoSpoilageDays') num(v, 0, 365);
        if (key === 'postDeathGraceSeconds') num(v, 0, 86400, true);
        if (key === 'productionSeconds') num(v, 10, 86400, true);
        if (key === 'lotteryTicketPrice') num(v, 1, 1000000, true);
        if (key === 'killReward') num(v, 0, 100000, true);
        if (key === 'pastureCapacityMultiplier') num(v, 0.25, 4);
        if (key === 'resourceRecoveryMultiplier') num(v, 0.25, 24);
        if (key === 'pasturePriceMultiplier') num(v, 0.25, 10);
        if (key === 'fishingMode') num(v, 0, 5, true);
        if (key === 'seaLevel') num(v, -50, 50);
        if (key === 'tidalRange') num(v, 0, 4);
        if (key === 'oceanWaves') num(v, 0, 2);
        if (key === 'mapSize') num(v, minMapSize, maxMapSize, true);
        (clean as Record<string, unknown>)[key] = v;
      }
      const tags = nameTagRules({ ...w.settings, ...clean });
      requireThat(
        tags.worldNameTagFadeStart <= tags.worldNameTagRange,
        'Building/vehicle name fade start must not exceed range',
      );
      requireThat(
        tags.pilotNameTagFadeStart <= tags.pilotNameTagRange,
        'Fade start must not exceed name-tag visibility range',
      );
      const arrival = parkingRules({ ...w.settings, ...clean });
      requireThat(
        arrival.arrivalMinSeconds <= arrival.arrivalMaxSeconds,
        'Shortest arrival must not exceed longest arrival',
      );
      const nextSettings = { ...w.settings, ...clean },
        previousSpawn = parishSpawn(w.settings),
        nextSpawn = parishSpawn(nextSettings);
      if (previousSpawn.x !== nextSpawn.x || previousSpawn.z !== nextSpawn.z) {
        const candidate = { ...w, settings: nextSettings };
        requireThat(
          Math.abs(nextSpawn.x) <= mapHalf(candidate) &&
            Math.abs(nextSpawn.z) <= mapHalf(candidate),
          'Keep arrival coordinates within this world’s map bounds',
        );
        const ground = terrainHeight(candidate, nextSpawn.x, nextSpawn.z);
        requireThat(
          ground >
            Math.max(highWater(candidate), surfaceWaterLevel(candidate, nextSpawn.x, nextSpawn.z)),
          'Choose dry arrival ground above high tide',
        );
        const reserve = { settings: nextSettings, towns: [], zones: [] };
        requireThat(
          !candidate.buildings.some(
            (b) =>
              buildingSpawnReason(reserve, b) ||
              buildingBlocksMovement(
                b,
                nextSpawn,
                nextSpawn,
                ground - terrainHeight(candidate, b.x, b.z),
                0,
              ),
          ) &&
            !creatorBlocks(
              candidate,
              nextSpawn.x,
              nextSpawn.z,
              ground,
              constructionRules(nextSettings).spawnClearance,
            ),
          'Choose a clear arrival site away from buildings and solid obstacles',
        );
      }
      if (Object.keys(landscapeRuleFields).some((key) => Object.hasOwn(clean, key))) {
        const limits = landscapeRules(nextSettings),
          schema = landscapeSchemaForRules(nextSettings);
        requireThat(
          w.terrain.length <= limits.terrainStampLimit,
          `Keep the terrain stamp limit at or above the ${w.terrain.length} existing stamps`,
        );
        requireThat(
          schema.safeParse(w.landscape ?? {}).success,
          'Keep landscape limits at or above existing saved content',
        );
        requireThat(
          (w.landscapeHistory ?? []).every((previous) => schema.safeParse(previous).success),
          'Keep landscape limits at or above retained undo history',
        );
      }
      const bridgeError = bridgeRulesError(nextSettings);
      requireThat(!bridgeError, bridgeError ?? 'Invalid bridge rules');
      const calendarError = calendarRulesError(nextSettings);
      requireThat(!calendarError, calendarError ?? 'Invalid calendar');
      const alpineError = alpineRulesError({ ...w.settings, ...clean });
      requireThat(!alpineError, alpineError ?? 'Invalid alpine climate');
      const climateError = climateRulesError({ ...w.settings, ...clean });
      requireThat(!climateError, climateError ?? 'Invalid climate rules');
      const loanError = loanRulesError({ ...w.settings, ...clean });
      requireThat(!loanError, loanError ?? 'Invalid loan rules');
      const npcPricingError = npcPricingRulesError({ ...w.settings, ...clean });
      requireThat(!npcPricingError, npcPricingError ?? 'Invalid resident pricing');
      const npcBusinessError = npcBusinessRulesError({ ...w.settings, ...clean });
      requireThat(!npcBusinessError, npcBusinessError ?? 'Invalid resident business budgets');
      const npcReserveError = npcReserveRulesError({ ...w.settings, ...clean });
      requireThat(!npcReserveError, npcReserveError ?? 'Invalid resident reserves');
      const towingError = towingRulesError({ ...w.settings, ...clean });
      requireThat(!towingError, towingError ?? 'Invalid towing rules');
      const charterError = charterRulesError({ ...w.settings, ...clean });
      requireThat(!charterError, charterError ?? 'Invalid charter rules');
      const creditError = creditRulesError({ ...w.settings, ...clean });
      requireThat(!creditError, creditError ?? 'Invalid credit rules');
      const survivalError = survivalRulesError({ ...w.settings, ...clean });
      requireThat(!survivalError, survivalError ?? 'Invalid survival rules');
      expireAbandonedCargo(w);
      expireMeat(w);
      changeResourceRules(w, clean);
      if (
        clean.exportShipmentInterval !== undefined &&
        clean.exportShipmentInterval !== economyRules(w.settings).exportShipmentInterval
      )
        w.exportShipmentAt = w.time;
      const priorEconomy = economyRules(w.settings);
      const importPricingChanged = governmentImportRuleKeys.some(
        (key) => clean[key] !== undefined && clean[key] !== priorEconomy[key],
      );
      const waterRules = waterSourceRules({ ...w.settings, ...clean });
      requireThat(
        waterRules.springHighElevation > waterRules.springLowElevation,
        'Upper spring elevation must exceed lower elevation',
      );
      requireThat(
        waterRules.springMaximumFlow >= waterRules.springMinimumFlow &&
          waterRules.springHeadwaterFlow >= waterRules.springMaximumFlow,
        'Headwater flow must be at least the ordinary flow range',
      );
      requireThat(
        waterRules.pumpIntakeMaxReach >= waterRules.pumpIntakeMinReach &&
          waterRules.desalinationIntakeMaxReach >= waterRules.desalinationIntakeMinReach,
        'Maximum intake reach must be at least its minimum',
      );
      if (
        Object.keys(clean).some(
          (key) => key === 'dayLength' || Object.hasOwn(livestockRuleFields, key),
        )
      )
        settleYoungGrowth(w);
      Object.assign(w.settings, clean);
      if (
        clean.vehiclesPersist === true ||
        clean.parkingNpcs === true ||
        clean.garageStoresSpareTractors === true
      )
        migrateParkedVehicles(w);
      refreshPumpRecipes(w);
      if (importPricingChanged) repriceGovernmentStores(w);
      w.revision++;
      break;
    }
    case 'terrain': {
      owner(p);
      const x = num(a.x, -mapHalf(w), mapHalf(w)),
        z = num(a.z, -mapHalf(w), mapHalf(w)),
        radius = num(a.radius, 1, 100),
        height = num(a.height, -30, 30);
      const limit = landscapeRules(w.settings).terrainStampLimit;
      requireThat(w.terrain.length < limit, `Terrain stamp limit reached (${limit})`);
      w.terrain.push({ x, z, radius, height });
      w.revision++;
      break;
    }
    case 'zone': {
      owner(p);
      const kind = str(a.kind);
      requireThat(
        ['safe', 'noBuild', 'spawn', 'game', 'script', 'vehicle'].includes(kind),
        'Invalid zone',
      );
      const x = num(a.x, -mapHalf(w), mapHalf(w)),
        z = num(a.z, -mapHalf(w), mapHalf(w)),
        radius = num(a.radius, 1, 100);
      requireThat(w.zones.length < 128, 'Zone limit reached');
      w.zones.push({
        id: 'z' + ++w.revision,
        kind: kind as World['zones'][0]['kind'],
        x,
        z,
        radius,
      });
      break;
    }
    case 'place': {
      owner(p);
      const kind = str(a.kind),
        x = num(a.x, -mapHalf(w), mapHalf(w)),
        z = num(a.z, -mapHalf(w), mapHalf(w));
      requireThat(catalog[kind], 'Unknown building');
      requireThat(w.buildings.length < 500, 'Building limit reached');
      const shore =
        kind === 'waterworks' ? waterworksSite(w, { x, z }, undefined, true) : undefined;
      requireThat(
        kind !== 'waterworks' || shore,
        'Desalination plants require a dry ocean shoreline site',
      );
      const b = makeBuilding('editor' + (w.revision + 1), kind, x, z);
      if (shore) b.rotation = shore.rotation;
      if (kind === 'boathouse' || kind === 'pumpHouse') {
        b.rotation = a.rotation === undefined ? 0 : num(a.rotation, -Math.PI * 2, Math.PI * 2);
        if (kind === 'pumpHouse') {
          const pump = pumpHouseSite(w, b);
          requireThat(pump, freshWaterReason);
          Object.assign(b, { x: pump.x, z: pump.z, waterSource: pump.waterSource });
        }
        const reason = constructionSiteReason(w, b, p);
        requireThat(!reason, reason!);
        b.foundationY = foundationProfile(w, b).level;
      }
      if (!slopeBypass(w, p)) {
        const slope = slopeAssessment(w, foundationProfile(w, b).surveys);
        requireThat(!slope.reason, slope.reason!);
      }
      const spawnReason = buildingSpawnReason(w, b);
      requireThat(!spawnReason, spawnReason!);
      b.owner = id;
      w.revision++;
      w.buildings.push(b);
      refreshPumpRecipes(w);
      break;
    }
    case 'postMail':
    case 'deleteMail':
    case 'family':
    case 'offerTrade':
    case 'acceptTrade':
    case 'cancelTrade':
      return socialAction(w, p, a);
    case 'group': {
      const kind = str(a.kind);
      requireThat(['tribe', 'family'].includes(kind), 'Unknown group');
      if (kind === 'family')
        return socialAction(w, p, { type: 'family', operation: 'create', name: a.name });
      p.tribe = str(a.name, 32);
      break;
    }
    case 'hitch': {
      requireThat(
        (!crewBerths(w.players[String(a.player)]?.vehicle ?? -1, w) &&
          w.players[String(a.player)]?.vehicle !== CHARTER_BOAT) ||
          !!w.boatRescues?.[p.id],
        'Join a fishing boat by accepting a deckhand offer, or hitch a recovery ride to your stranded boat',
      );
      requireThat(p.game !== 'combat', 'Leave combat before hitching a ride');
      const target = w.players[String(a.player)];
      requireThat(
        !boatSlot(p.vehicle, w) && !p.hitch,
        'Disembark at the boathouse before changing rides',
      );
      if (poweredBoat(target?.vehicle ?? -1, w)) {
        const dock = boatLanding(w, target, true, a.building);
        requireThat(
          dock && boatLanding(w, p, false, dock.id),
          'Board boat passengers at the boathouse shore entrance',
        );
      }
      requireThat(
        target &&
          target.id !== id &&
          stoppedOutside(p) &&
          stoppedOutside(target) &&
          target.vehicle !== 5 &&
          distance(p, target) < (poweredBoat(target.vehicle, w) ? 48 : 10) &&
          Math.abs(p.y - target.y) <= 3,
        'No nearby driver',
      );
      requireThat(
        Object.values(w.players).filter((p) => p.hitch === target.id).length <
          Math.max(crewBerths(target.vehicle, w), vehicleDef(w, target.vehicle).hitch),
        'No passenger room',
      );
      p.hitch = target.id;
      Object.assign(p, { x: target.x, z: target.z, y: target.y + 2, speed: 0 });
      break;
    }
    case 'detach': {
      const captain = fishingCrewCaptain(w, p);
      if (p.hitch && boatSlot(w.players[p.hitch]?.vehicle ?? -1, w)) {
        const driver = w.players[p.hitch];
        const dock = boatLanding(w, driver, true, a.building);
        requireThat(
          dock && Math.abs(driver.speed) < 0.5,
          'Wait for the boat to stop at a boathouse berth',
        );
        const land = dock.land;
        requireThat(
          !w.buildings.some((b) => buildingBlocksMovement(b, land, land, 0, 1.5)) &&
            !creatorBlocks(w, land.x, land.z, travelHeight(w, land.x, land.z), 1.5),
          'The shore landing is blocked',
        );
        if (p.charterPassage)
          settleCharterPassenger(w, driver, p, !sameCharterDock(driver.charter?.dock, dock.id));
        Object.assign(p, land, { y: travelHeight(w, land.x, land.z), speed: 0 });
      }
      if (captain && !captain.fishingVoyage!.departed) delete captain.fishingVoyage!.members[p.id];
      delete p.hitch;
      break;
    }
    case 'giveMoney': {
      const target = w.players[str(a.player)],
        n = num(a.amount, 1, economyRules(w.settings).maximumMoneyGift, true);
      const reason = moneyGiftReason(w, p, target);
      requireThat(!reason, reason ?? 'Cannot give money');
      requireThat(p.cash >= n, 'Not enough cash in hand');
      requireThat(Number.isSafeInteger(target.cash + n), 'Recipient cash limit reached');
      p.cash -= n;
      target.cash += n;
      log(w, 'transfer', n, p.id, target.id, 'player gift');
      say(
        w,
        'Money gift',
        `${p.name} gave you ${money(n, w.settings.denariiPerSheckle)}.`,
        'system',
        target.id,
      );
      say(
        w,
        'Money gift',
        `You gave ${target.name} ${money(n, w.settings.denariiPerSheckle)}.`,
        'system',
        p.id,
      );
      break;
    }
    case 'refuelParked': {
      const status = parkedRefuelStatus(
        w,
        p,
        a.owner === undefined ? p.id : str(a.owner),
        num(a.slot, 0, vehicles.length - 1, true),
      );
      requireThat(!status.reason, status.reason ?? 'Cannot refuel');
      stockAdd(p.inventory, 'fuel', -1);
      status.vehicle!.fuel += status.units;
      break;
    }
    case 'refuelPlayer': {
      const target = w.players[str(a.player)],
        status = refuellingStatus(w, p, target);
      requireThat(!status.reason, status.reason ?? 'Cannot refuel');
      stockAdd(p.inventory, 'fuel', -1);
      if (status.parked) status.parked.fuel += status.units;
      else target.fuel = Math.min(fuelCapacity(target, w), target.fuel + status.units);
      const amount = Number(status.units.toFixed(2));
      say(
        w,
        'Roadside help',
        `${p.name} refuelled your vehicle (+${amount} fuel).`,
        'system',
        target.id,
      );
      say(
        w,
        'Roadside help',
        `You used 1 Fuel to refuel ${target.name} (+${amount} fuel).`,
        'system',
        p.id,
      );
      break;
    }
    case 'give': {
      const target = w.players[String(a.player)],
        item = str(a.item),
        n = qty(w, a.quantity);
      requireThat(
        target && target.id !== id && distance(p, target) < 15,
        'Recipient must be nearby',
      );
      requireThat(items[item] && (p.inventory[item] ?? 0) >= n, 'Not enough items');
      requireThat(canCarry(target, item, n, w), 'Recipient cargo full');
      stockAdd(p.inventory, item, -n);
      stockAdd(target.inventory, item, n);
      break;
    }
    case 'radio':
      return radioAction(w, p, a);
    case 'chat': {
      const text = chatText(w, p, a.text);
      if (text.startsWith('*')) return command(w, p, text);
      const to = a.to === undefined ? undefined : str(a.to);
      requireThat(!to || w.players[to], 'Unknown recipient');
      say(w, p.name, text, 'chat', to);
      if (p.npc) w.messages.at(-1)!.npc = true;
      break;
    }
    case 'command':
      return command(w, p, str(a.text, 300));
    default:
      throw Error('Unknown action');
  }
  return result;
}
export function command(w: World, p: Player, text: string): string {
  const [cmd, ...args] = text.replace(/^\*/, '').split(/\s+/);
  if (
    w.maintenance?.paused &&
    ![
      'help',
      'showfuel',
      'showjobs',
      'jobs',
      'showowned',
      'economy',
      'me',
      'town',
      'showresidents',
      'say',
      'announce',
      'gag',
      'kick',
    ].includes(cmd)
  )
    throw Error('World paused for maintenance');
  const publicCommands = [
    'help',
    'showfuel',
    'showjobs',
    'jobs',
    'showowned',
    'economy',
    'me',
    'resetpos',
    'town',
    'showresidents',
  ];
  requireThat(
    publicCommands.includes(cmd) ||
      p.authority >=
        ({
          say: 4,
          announce: 10,
          kick: 10,
          gag: 10,
          teleport: 12,
          cash: 16,
          grantitem: 16,
          settime: 16,
          sethealth: 16,
          setvehicle: 16,
          sethometown: 16,
          fighting: 20,
        }[cmd] ?? 20),
    'Insufficient authority',
  );
  const target = () => {
    const t = Object.values(w.players).find((p) => p.name === args[0] || p.id === args[0]);
    requireThat(t, 'Player not found');
    return t;
  };
  switch (cmd) {
    case 'help':
      return 'Player: *showfuel *showjobs *showowned *economy *me *town *showresidents [town]. Admin: *say *announce *kick *gag *teleport *cash *grantitem *settime *sethealth *setvehicle *sethometown [player] [town] *fighting.';
    case 'town': {
      const home = p.town ? findTown(w, p.town) : undefined;
      return home ? residentList(w, home) : 'You have no home town. Join one at its town plinth.';
    }
    case 'showresidents': {
      const t = findTown(w, args.join(' ') || p.town || '');
      requireThat(t, 'Town not found');
      return residentList(w, t);
    }
    case 'sethometown': {
      const who = target(),
        t = findTown(w, args.slice(1).join(' '));
      requireThat(t, 'Town not found');
      setHomeTown(w, who, t);
      return `${who.name} now lives in ${t.name}.`;
    }
    case 'showfuel':
      return `Fuel: ${p.fuel.toFixed(1)} / ${fuelCapacity(p, w)}`;
    case 'showjobs':
    case 'jobs':
      return w.buildings
        .filter((b) => b.recipe || b.kind === 'lighthouse')
        .map((b) =>
          b.kind === 'lighthouse'
            ? `${b.name}: ${money(lighthouseWage(w.settings, b.wage))} / game day; one unskilled keeper, quarters included`
            : `${b.name}: ${money(b.wage)} / cycle`,
        )
        .join(' · ');
    case 'showowned':
      return (
        w.buildings
          .filter((b) => b.owner === p.id)
          .map((b) => b.name)
          .join(', ') || 'You own no property. A refreshingly simple life.'
      );
    case 'economy':
      return `${w.settings.maxBuildings} businesses, ${w.settings.maxHomes} homes. Sales tax ${(w.settings.salesTax * 100).toFixed(0)}%.`;
    case 'me':
      say(w, p.name, args.join(' '), 'emote');
      break;
    case 'resetpos':
      throw Error(
        'Position reset is unavailable. Ask another player for fuel or recovery assistance.',
      );
    case 'say':
    case 'announce':
      say(w, 'Caretaker', args.join(' '));
      break;
    case 'cash':
      grant(w, target(), num(Number(args[1]) * 100, 1, 100000000, true), 'admin grant');
      break;
    case 'grantitem': {
      delete target().courseRun;
      const t = target(),
        item = args[1],
        n = qty(w, Number(args[2]));
      requireThat(worldItems(w)[item] && canCarry(t, item, n, w), 'Unknown item or cargo full');
      stockAdd(t.inventory, item, n);
      break;
    }
    case 'sethealth':
      target().health = num(Number(args[1]), 1, maximumHealth(target(), w));
      break;
    case 'setvehicle':
      switchVehicle(target(), num(Number(args[1]), 0, vehicles.length - 1, true), true, w);
      break;
    case 'gag':
      target().muted = !target().muted;
      break;
    case 'kick':
      target().online = false;
      break;
    case 'teleport': {
      delete target().courseRun;
      const t = target(),
        x = num(Number(args[1]), -mapHalf(w), mapHalf(w)),
        z = num(Number(args[2]), -mapHalf(w), mapHalf(w));
      t.x = x;
      t.z = z;
      t.speed = 0;
      t.y = travelHeight(w, x, z);
      delete t.flight;
      break;
    }
    case 'settime':
      w.settings.time = num(Number(args[0]), 0, 86400);
      break;
    case 'fighting':
      requireThat(['0', '1'].includes(args[0]), 'Use 0 or 1');
      w.settings.fighting = args[0] === '1';
      break;
    default:
      throw Error('Unknown command. Try *help.');
  }
  return 'Command applied.';
}
export function move(w: World, p: Player, input: Input, dt: number, prediction = false) {
  if (w.maintenance?.paused) return;
  if (beingTowed(w, p)) {
    p.speed = 0;
    p.boatThrottle = 0;
    return;
  }
  const towBefore = { x: p.x, z: p.z, heading: p.heading };
  if (p.game === 'fishing')
    p.y = poweredBoat(p.vehicle, w) ? surfaceWaterLevel(w, p.x, p.z) : travelHeight(w, p.x, p.z);
  if (
    p.task ||
    p.atHome ||
    p.inside ||
    p.hitch ||
    (p.race && w.time < p.race.start) ||
    p.game === 'fishing'
  )
    return;
  if (helmBlock(w, p.vehicle, p.skills)) {
    p.speed = 0;
    return;
  }
  const condition = w.settings.vehicleMaintenance && !p.game ? vehicleCondition(p) : 100;
  const v = vehicleDef(w, p.vehicle),
    ground = v.mode === 3 ? terrainHeight(w, p.x, p.z) : travelHeight(w, p.x, p.z),
    water = ground < surfaceWaterLevel(w, p.x, p.z);
  if (v.mode === 2) {
    const previous = { x: p.x, z: p.z, y: p.y, fuel: p.fuel };
    let solidFlightContact = false;
    const accident = fly(p, input, dt, {
      settings: w.settings,
      ground: (x, z) => travelHeight(w, x, z),
      seaLevel: waterLevel(w),
      half: mapHalf(w),
      grip: drivingSurface(w, p.x, p.z).grip,
      fuelRate: v.fuel,
      speed: v.speed,
      acceleration: v.acceleration,
      turn: v.turn,
      condition,
      groundContact: (from, to) => {
        const self = { ...p, ...from };
        const scenery = sceneryContact(w, self, to);
        const contact = scenery.stopped
          ? scenery
          : playerContact(w, self, scenery.point, prediction);
        solidFlightContact ||=
          contact.stopped || contact.point.x !== to.x || contact.point.z !== to.z;
        return solidFlightContact;
      },
      blocked: (from, to) =>
        creatorBlocksSegment(w, from, to, 2.0, true) ||
        w.buildings.some((b) =>
          buildingBlocksMovement(
            b,
            from,
            to,
            Math.min(from.y, to.y) - terrainHeight(w, b.x, b.z),
            2.0,
          ),
        ),
    });
    if (solidFlightContact && !accident) {
      Object.assign(p, previous);
      stopGroundVehicle(p);
    } else recordTravel(w, p, Math.hypot(p.x - previous.x, p.z - previous.z));
    if (accident) {
      const slot = p.vehicle;
      p.lastFlightCrash = { at: w.time, cause: accident, slot, x: p.x, y: p.y, z: p.z };
      p.fleet = (p.fleet ?? [0, 5]).filter((v) => v !== slot);
      if (p.fleetState) delete p.fleetState[slot];
      if (p.vehiclePaints) delete p.vehiclePaints[slot];
      if (p.parkedFuel) delete p.parkedFuel[slot];
      p.vehicle = 5;
      p.fuelVehicle = returnTractor(p);
      p.fuel = p.parkedFuel?.[p.fuelVehicle] ?? 0;
      if (p.parkedFuel) delete p.parkedFuel[p.fuelVehicle];
      delete p.flight;
      p.engine = false;
      p.speed = 0;
      p.y = travelHeight(w, p.x, p.z);
      p.health = Math.max(1000, p.health - 20000);
      if (!prediction)
        say(
          w,
          'Airfield notice',
          `${p.name}'s ${v.name} was destroyed: ${accident}. The pilot escaped injured.`,
        );
    }
    return;
  }
  delete p.flight;
  let throttleInput = clamp(input.throttle, -1, 1);
  if (v.mode !== 3 || Math.sign(throttleInput) !== p.boatShoreThrottle) delete p.boatShoreThrottle;
  if (v.mode === 3 && p.boatShoreThrottle !== undefined) throttleInput = 0;
  if (throttleBoat(p.vehicle, w))
    p.boatThrottle = input.brake
      ? 0
      : clamp((p.boatThrottle ?? 0) + throttleInput * 0.24 * dt, -0.4, 1);
  const throttle = throttleBoat(p.vehicle, w) ? (p.boatThrottle ?? 0) : throttleInput;
  const rowing =
    p.vehicle === CANOE || p.vehicle === ROWBOAT || (p.vehicle === MOTORBOAT && p.fuel <= 0);
  const powered = (p.engine && p.fuel > 0) || v.fuel === 0 || rowing;
  const grounded = [0, 1, 4].includes(v.mode) && p.y <= ground + 1;
  const motorGrounded = grounded && v.fuel > 0;
  const grade = motorGrounded ? drivingGrade(w, p.x, p.z, p.heading) / (v.torque ?? 1) : 0;
  const surface =
    v.mode === 8 && p.y <= ground + 1
      ? walkingSurface(w, p.x, p.z)
      : grounded
        ? v.fuel > 0 || isEarthmover(p.vehicle)
          ? drivingSurface(w, p.x, p.z, isEarthmover(p.vehicle))
          : roadConditions(w)
        : { speed: 1, grip: 1 };
  const traction =
    (w.climate?.snow ?? 0) > 0.08
      ? (v.snowTraction ?? v.traction)
      : (w.climate?.wetness ?? 0) > 0.18
        ? (v.rainTraction ?? v.traction)
        : v.traction;
  const crowSpeed = p.crowBody && p.crowClass ? crowClasses[p.crowClass].speed : 1;
  const trawling = isTrawler(p.vehicle, w) && p.trawl?.deployed;
  const loadFactors = boatLoadFactors(w, p),
    fuelBefore = p.fuel;
  const cap =
    (p.carrying ? canoeRules(w.settings).canoeCarrySpeed : 1) *
    crowSpeed *
    (grounded && riverDepth(w, p) > 0.1 ? 0.62 : 1) *
    (activeTow(w, p.id) ? 0.5 : towingTender(w, p) ? 0.85 : 1) *
    trailerFactors(w, p).speed *
    loadFactors.speed *
    ([CANOE, ROWBOAT].includes(p.vehicle)
      ? v.speed
      : rowing
        ? rowboatRules(w.settings).motorboatRowingSpeed
        : trawling
          ? trawlParameters(w, p.vehicle).speed
          : v.speed) *
    (input.boost &&
    !isEarthmover(p.vehicle) &&
    !p.carrying &&
    !rowing &&
    !throttleBoat(p.vehicle, w)
      ? 1.7
      : 1) *
    tractorSurface(surface.speed, traction) *
    (0.7 + condition * 0.003);
  if (p.vehicle === HIGHWAY_TRACTOR)
    highwayControls(
      w,
      p,
      { ...input, steer: intoxicatedSteer(p, w.time, clamp(input.steer, -1, 1)) },
      dt,
      grade,
      condition,
      powered,
      prediction,
    );
  else {
    p.speed +=
      ((powered ? throttle : 0) *
        (rowing && p.vehicle === MOTORBOAT
          ? rowboatRules(w.settings).motorboatRowingAcceleration
          : v.acceleration) *
        tractorSurface(surface.grip, traction) *
        slopeSpeed(grade * Math.sign(throttle)) -
        p.speed * (throttle ? 0.13 : 1.8)) *
      dt;
    p.speed = clamp(p.speed, -cap * 0.4 * slopeSpeed(-grade), cap * slopeSpeed(grade));
    p.heading +=
      intoxicatedSteer(p, w.time, clamp(input.steer, -1, 1)) *
      v.turn *
      tractorSurface(surface.grip, traction) *
      (input.boost && !p.carrying && !rowing && !throttleBoat(p.vehicle, w) ? 1.15 : 1) *
      dt *
      ([0, 1, 4].includes(v.mode) && p.speed < 0 ? -1 : 1) *
      (Math.abs(p.speed) > 0.1 ? 1 : 0);
  }
  if (isEarthmover(p.vehicle)) {
    const field = !('onRoad' in surface && surface.onRoad);
    const limit = Math.min(v.speed, field ? (v.offRoadSpeed ?? v.speed) : v.speed);
    p.speed = clamp(p.speed, -limit * 0.4, limit);
  }
  if (v.mode === 2 || v.mode === 6)
    p.y = Math.max(
      ground,
      p.y + ((input.lift ?? 0) * 12 + (v.mode === 2 ? (Math.abs(p.speed) > 14 ? 2 : -4) : 0)) * dt,
    );
  else if (!p.carrying && (input.lift ?? 0) > 0 && (p.inventory.jetpack ?? 0) > 0 && p.fuel > 0) {
    p.y += 12 * dt;
    p.fuel = Math.max(0, p.fuel - 0.08 * dt);
  } else p.y = Math.max(ground, p.y - 9.8 * dt);
  if (v.mode === 3) {
    const amp = inlandWaterAt(w, p.x, p.z) ? 0 : oceanWeather(w).amplitude;
    const impact = waveImpact(p.x, p.z, w.time, p.heading, p.speed, amp, waterLevel(w) - ground);
    p.speed *= Math.exp(-impact * dt * 0.45);
    p.y = boatSeaPose(
      w,
      p.x,
      p.z,
      p.heading,
      v.length ??
        (isTrawler(p.vehicle, w)
          ? 21
          : p.vehicle === CHARTER_BOAT
            ? 15
            : p.vehicle === LIFEBOAT
              ? 3
              : 12),
      v.beam ?? (isTrawler(p.vehicle, w) ? 6 : p.vehicle === CHARTER_BOAT ? 5 : 3),
      w.time,
      amp,
    ).y;
  }
  if (v.mode === 5) p.y = Math.max(ground, surfaceWaterLevel(w, p.x, p.z)) + 0.5;
  const half = mapHalf(w);
  const previousPosition = { x: p.x, z: p.z };
  let nx = clamp(p.x + Math.sin(p.heading) * p.speed * dt, -half, half),
    nz = clamp(p.z + Math.cos(p.heading) * p.speed * dt, -half, half);
  if (p.vehicle === HIGHWAY_TRACTOR) {
    const from = { ...p, ...towBefore };
    const surfaceLimit =
      highwaySurface(w, from, { x: nx, z: nz, heading: p.heading }, prediction).speed *
      roadConditions(w).speed;
    if (Math.abs(p.speed) > surfaceLimit) {
      p.speed = Math.sign(p.speed) * surfaceLimit;
      nx = p.x + Math.sin(p.heading) * p.speed * dt;
      nz = p.z + Math.cos(p.heading) * p.speed * dt;
    }
  }
  let solidStopped = false;
  if (onSolidGround(w, p)) {
    const scenery = sceneryContact(w, p, { x: nx, z: nz });
    const contact = scenery.stopped ? scenery : playerContact(w, p, scenery.point, prediction);
    // A hull slide changes the path; never redirect into scenery already cleared by the original sweep.
    const redirectedBlocked =
      (contact.point.x !== scenery.point.x || contact.point.z !== scenery.point.z) &&
      sceneryBlocksSegment(
        w,
        p,
        contact.point,
        v.collisionRadius ?? (v.mode === 8 ? 0.25 : 1.3),
        true,
      );
    solidStopped =
      contact.stopped ||
      redirectedBlocked ||
      bridgeGroundBlocked(w, p, contact.point, towBefore.heading);
    nx = redirectedBlocked ? p.x : contact.point.x;
    nz = redirectedBlocked ? p.z : contact.point.z;
  }
  if (
    p.vehicle === HIGHWAY_TRACTOR &&
    (solidStopped ||
      !clearHighwayRig(w, p, towBefore, { x: nx, z: nz, heading: p.heading }, prediction))
  ) {
    p.heading = towBefore.heading;
    p.speed = 0;
    return;
  }
  const gentleCanoe =
    (p.vehicle === CANOE && Math.abs(p.speed) <= canoeRules(w.settings).canoeShoreSpeed) ||
    (p.vehicle === ROWBOAT && Math.abs(p.speed) <= rowboatRules(w.settings).rowboatShoreSpeed);
  const shore =
    v.mode === 3
      ? boatShoreCollision(
          w,
          p,
          { x: nx, z: nz },
          v.draft !== undefined
            ? (v.beam ?? 2 * (v.collisionRadius ?? 1.3)) / 2
            : (v.collisionRadius ?? 1.3),
          p.heading,
          v.length !== undefined
            ? v.length / 2
            : isTrawler(p.vehicle, w)
              ? 10.5
              : p.vehicle === CHARTER_BOAT
                ? 7.5
                : p.vehicle === 3
                  ? 6
                  : p.vehicle === LIFEBOAT
                    ? 1.5
                    : (v.collisionRadius ?? 1.3),
          p.vehicle === CANOE
            ? canoeRules(w.settings).canoeMinDepth
            : p.vehicle === ROWBOAT
              ? rowboatRules(w.settings).rowboatMinDepth
              : v.draft,
          gentleCanoe,
          v.airDraft,
        )
      : undefined;
  if (solidStopped) {
    stopGroundVehicle(p);
  } else if (
    [0, 1, 4, 5, 8].includes(v.mode) &&
    p.y <= ground + 2 &&
    (cliffBlocks(w, p, { x: nx, z: nz }, p.vehicle === 5 ? 0.35 : (v.collisionRadius ?? 1.3)) ||
      ([0, 1, 4, 8].includes(v.mode) &&
        inlandBlocksGround(
          w,
          p,
          { x: nx, z: nz },
          p.vehicle === 5 ? 0.35 : (v.collisionRadius ?? 1.3),
        )))
  ) {
    p.speed = 0;
  } else if (shore) {
    // Copy nested fleet state: client prediction must not mutate a server snapshot.
    if (!gentleCanoe && maintainable(p.vehicle, w) && Math.abs(p.speed) > 0.1) {
      const old = p.fleetState?.[p.vehicle] ?? { acquiredAt: w.time, metres: 0, condition: 100 };
      p.fleetState = {
        ...p.fleetState,
        [p.vehicle]: {
          ...old,
          condition: Math.max(
            0,
            old.condition - boatNavigationRules(w.settings).boatShoreImpactLoss,
          ),
        },
      };
    }
    const recoilBlocked =
      creatorBlocksSegment(w, p, { ...shore, y: p.y }, v.collisionRadius ?? 1.3, true) ||
      w.buildings.some((b) =>
        buildingBlocksMovement(
          b,
          p,
          shore,
          p.y - terrainHeight(w, b.x, b.z),
          v.collisionRadius ?? 1.3,
        ),
      );
    if (!recoilBlocked) {
      p.x = shore.x;
      p.z = shore.z;
    }
    p.speed = 0;
    p.boatThrottle = 0;
    if (!gentleCanoe && input.throttle) p.boatShoreThrottle = Math.sign(input.throttle);
  } else if (
    !(
      v.mode !== 3 &&
      p.vehicle !== HIGHWAY_TRACTOR &&
      p.y < ground + 2 &&
      trailerBlocks(
        w,
        p,
        { x: nx, z: nz },
        p.vehicle === 5 ? 0.25 : (v.collisionRadius ?? 1.3),
        attachedTrailer(w, p)?.id,
        true,
      )
    ) &&
    !creatorBlocksSegment(
      w,
      p,
      { x: nx, z: nz, y: p.y },
      p.vehicle === 5 ? 0.25 : (v.collisionRadius ?? 1.3),
      true,
    ) &&
    !w.buildings.some((b) =>
      buildingBlocksMovement(
        b,
        p,
        { x: nx, z: nz },
        p.y - terrainHeight(w, b.x, b.z),
        p.vehicle === 5 ? 0.25 : (v.collisionRadius ?? 1.3),
      ),
    )
  ) {
    const travelled = Math.hypot(nx - p.x, nz - p.z);
    recordTravel(w, p, travelled);
    p.x = nx;
    p.z = nz;
    if (v.mode !== 3) {
      const support = travelHeight(w, p.x, p.z);
      // Stay on continuous hills while descending quickly; intentional jetpack
      // lift and actual drop-offs still use the existing airborne behavior.
      const lifted = (input.lift ?? 0) > 0 && (p.inventory.jetpack ?? 0) > 0 && p.fuel > 0;
      p.y =
        motorGrounded && !lifted && Math.abs(support - ground) <= Math.max(0.1, travelled * 0.75)
          ? support
          : Math.max(p.y, support);
    }
  } else p.speed *= -0.2;
  if (water && ![2, 3, 5, 6].includes(v.mode) && p.y < waterLevel(w) - 1) {
    Object.assign(p, parishSpawnPosition(w), { speed: 0 });
  }
  if (trawling)
    advanceTrawl(
      w,
      p,
      dt,
      Math.hypot(p.x - previousPosition.x, p.z - previousPosition.z),
      prediction,
    );
  else if (powered)
    p.fuel = Math.max(
      0,
      p.fuel -
        (Math.abs(p.speed) / v.speed) *
          v.fuel *
          trailerFactors(w, p).fuel *
          (activeTow(w, p.id) ? 1.6 : towingTender(w, p) ? 1.2 : 1) *
          loadFactors.fuel *
          (input.boost &&
          p.vehicle !== HIGHWAY_TRACTOR &&
          !p.carrying &&
          !throttleBoat(p.vehicle, w)
            ? 2
            : 1) *
          (1 + (100 - condition) * 0.003) *
          dt,
    );
  workEarthwork(w, p, previousPosition, dt, prediction);
  moveTrailer(w, p, towBefore, dt, prediction);
  if (onSolidGround(w, p)) updateBridgePassages(w, p);
  moveTow(w, p, towBefore, prediction);
  moveTender(w, p, towBefore, prediction);
  if (!prediction) {
    voyageFuel(w, p, fuelBefore - p.fuel);
    const craft = p.smallCraft && w.smallCraft?.[p.smallCraft];
    if (craft) Object.assign(craft, { x: p.x, z: p.z, heading: p.heading });
  }
}
function announceDeath(w: World, p: Player) {
  return (
    p.online || !p.deathAnnouncedSinceVisit || !survivalRules(w.settings).muteRepeatedOfflineDeaths
  );
}
function kill(
  w: World,
  p: Player,
  comic = false,
  cause = 'injury',
  at = w.time,
  destroyedBoat = false,
) {
  delete p.bridgePasses;
  delete p.bridgeSurvey;
  delete p.stormExposure;
  if (!comic) canoeDeath(w, p);
  detachTrailer(w, p, !comic && w.settings.loseInventoryOnDeath);
  cancelPlayerTows(w, p.id);
  cancelEarthworksOnDeath(w, p.id);
  delete p.earthmovingImplement;
  for (const t of Object.values(w.mooredBoats ?? {}))
    if (t.owner === p.id) {
      delete t.towedBy;
      delete t.rope;
    }
  cancelChartersOnDeath(w, p);
  const recovery = !comic ? abandonBoatOnDeath(w, p, at, destroyedBoat) : undefined;
  delete p.smallCraft;
  endVoyageOnDeath(w, p);
  if (!comic) contractsOnDeath(w, p);
  if (!comic) p.needsGraceUntil = at + (w.settings.postDeathGraceSeconds ?? 0);
  if (!comic)
    recordLife(w, p, { kind: 'death', cause, text: `New life after ${cause}`, x: p.x, z: p.z });
  p.deaths++;
  delete p.flight;
  delete p.trawl;
  delete p.boatThrottle;
  delete p.nutrition;
  delete p.alcohol;
  breakLabourStreak(p);
  p.ammo = { ...ammunition };
  p.invulnerableUntil = w.time + 3;
  p.health = survivalRules(w.settings).baseMaximumHealth;
  p.hunger = 5000;
  p.thirst = 5000;
  p.speed = 0;
  Object.assign(p, parishSpawnPosition(w));
  p.atHome = false;
  delete p.hitch;
  delete p.task;
  delete p.crowBody;
  delete p.crowClass;
  delete p.crowIntegrity;
  delete p.crowMark;
  delete p.crowRecallAt;
  if (comic) {
    p.vehicle = 6;
    say(
      w,
      'Parish notice',
      p.game === 'combat'
        ? `${p.name} was knocked out. Returning to the team base.`
        : `${p.name} has become an ostrich. These things happen.`,
    );
  } else {
    if (recovery) {
      delete p.game;
      delete p.fishAt;
      delete p.fishUntil;
      switchVehicle(p, 5, false, w);
      p.engine = false;
      if (recovery.dock) Object.assign(p, recovery.dock.land);
      p.y = travelHeight(w, p.x, p.z);
    }
    resetQuests(w, p);
    if (w.settings.resetScriptOnDeath) p.scriptState = {};
    queueCreatorScript(w, 'PlayerDeath', { id: p.id, cause, deaths: p.deaths });
    p.age = 18;
    if (w.settings.loseSkillsOnDeath) {
      p.skills = [];
      delete p.learning;
    }
    if (w.settings.loseInventoryOnDeath) {
      p.inventory = {};
      delete p.earthmovingCargo;
      delete p.inventoryLife;
    }
    if (w.settings.loseJobOnDeath) {
      delete p.job;
      p.activeUntil = 0;
    }
    const cashLoss = p.cash - Math.floor(p.cash * w.settings.deathCashRetention);
    const bankLoss = p.bank - Math.floor(p.bank * w.settings.deathBankRetention);
    p.cash -= cashLoss;
    p.bank -= bankLoss;
    log(w, 'sink', cashLoss, p.id, 'treasury', 'death cash loss');
    log(w, 'sink', bankLoss, p.id + ':bank', 'treasury', 'death savings loss');
    if (w.settings.losePropertyOnDeath) forecloseEstate(w, p);
    for (const b of w.buildings) {
      if (w.settings.loseJobOnDeath) b.employees = b.employees.filter((id) => id !== p.id);
      if (w.settings.losePropertyOnDeath && b.owner === p.id) {
        if (roomCount(b)) {
          if (b.lodging) b.lodging.open = false;
          continue;
        }
        if (!w.settings.retainEstateContents) {
          refundStakes(w, b);
          clearManufacturingEstate(w, b);
          b.stock = {};
          log(w, 'sink', b.investment, b.id, 'treasury', 'estate closure');
          b.investment = 0;
        }
        releaseEstate(w, b);
      }
    }
    if (announceDeath(w, p))
      say(
        w,
        'Parish notice',
        `${p.name} has begun a new life. This world ${w.settings.loseSkillsOnDeath ? 'clears' : 'preserves'} qualifications and ${w.settings.losePropertyOnDeath ? 'releases ordinary property' : 'preserves property'}.`,
      );
    p.deathAnnouncedSinceVisit = true;
  }
}
export function productionInterval(w: World, b: Building) {
  if (b.kind === 'automotiveFactory')
    return b.manufacturing?.orders[0]?.seconds ?? automotiveConfig(w).products.tractor.seconds;
  if (b.kind === 'lighthouse') return Math.max(60, w.settings.dayLength || 600);
  return (
    b.production?.seconds ??
    (((b.recipe ? recipes[b.recipe]?.seconds : 600) ?? 600) / 600) * w.settings.productionSeconds
  );
}
function cycle(w: World, b: Building, at: number) {
  expireMeatStock(w, b.stock, at);
  if (b.kind === 'lighthouse') {
    if (b.construction) return;
    // Navigation is a public service: a small fixed grant, independent of size or capital.
    if (b.owner && b.owner !== 'treasury') {
      b.investment += 400;
      log(w, 'faucet', 400, 'navigation service', b.id, 'lighthouse owner allowance');
    }
    const keeper = w.players[b.employees[0]];
    if (
      w.settings.jobsEnabled !== false &&
      keeper &&
      isLighthouseKeeper(b, keeper) &&
      (!w.settings.activeWork || keeper.activeUntil >= at)
    ) {
      const wage = lighthouseWage(w.settings, b.wage);
      const tax = Math.floor(wage * w.settings.wageTax),
        town = taxTown(w, b.x, b.z);
      const local = town ? Math.min(wage - tax, Math.floor(wage * town.wageTax)) : 0;
      log(w, 'faucet', wage, 'navigation service', b.id, 'keeper wage funding');
      keeper.cash += wage - tax - local;
      log(w, 'transfer', wage - tax - local, b.id, keeper.id, 'wage');
      log(w, 'sink', tax, b.id, 'treasury', 'wage tax');
      if (town) payTown(w, town, b.id, local, 'wage tax');
    }
    return;
  }
  const r = worldMeatRecipe(b, w.settings) ?? b.production ?? (b.recipe && recipes[b.recipe]);
  if (!r || b.construction || b.kind === 'farm' || b.kind === 'automotiveFactory') return;
  if (b.kind === 'butcher' && !meatRules(w.settings).butchersEnabled) {
    b.efficiency = 0;
    return;
  }
  if (waterProductionBlocker(w, b)) {
    b.efficiency = 0;
    return;
  }
  removeOwnerEmployment(w, b);
  const staff = productionStaff(w, b, at);
  const workingOwner = ownerOperating(w, b, at) && b.owner ? w.players[b.owner] : undefined;
  const carers = workingOwner ? [...staff, workingOwner] : staff;
  const healthyHerd = tendHerd(w, b, carers.length, at);
  birthHerd(w, b, at);
  if (
    b.continuousBreeding &&
    livestockRules(w.settings).livestockContinuousAllowed &&
    (!(b.owner && w.players[b.owner]?.npc) || npcBreedingBudgetAllows(w, b)) &&
    carers.length
  ) {
    const breeder = carers.find((p) => p.skills.includes('livestock farmer'));
    if (breeder && !breedingBlocker(w, breeder, b)) {
      const fee = breedHerd(w, breeder, b, at);
      log(w, 'sink', fee, b.id, 'treasury', 'continuous livestock breeding');
    }
  }
  if (!healthyHerd) {
    b.efficiency = 0;
    return;
  }
  const efficiency = productionEfficiency(w, b, staff.length, at);
  b.efficiency = efficiency;
  b.progress += efficiency;
  // Fractional crews (for example 2/7) must not lose a completed batch to rounding.
  const times = Math.floor(b.progress + 1e-9);
  if (times < 1) return;
  b.progress = Math.max(0, b.progress - times);
  for (let i = 0; i < times; i++) {
    if (!productionSupplied(b, r, staff.length, true, w)) return;
    const inputs = Object.fromEntries(
      Object.entries(r.inputs).filter(([id]) => !herdSpec(b) || !['feed', 'water'].includes(id)),
    );
    for (const [item, n] of Object.entries(inputs)) consumeStock(w, b.stock, item, n, at);
    const outputs = livestockOutputs(
      b,
      r.outputs,
      w.settings.pastureCapacityMultiplier ?? 1,
      w.settings,
    );
    for (const [item, n] of Object.entries(outputs)) addFreshMeat(w, b.stock, item, n, at);
    const statement = accounts(w, b);
    statement.batches++;
    addQuantities(statement.consumed, inputs);
    addQuantities(statement.produced, outputs);
    const town = taxTown(w, b.x, b.z);
    for (const p of staff) {
      const tax = Math.floor(b.wage * w.settings.wageTax),
        local = town ? Math.min(b.wage - tax, Math.floor(b.wage * town.wageTax)) : 0;
      b.investment -= b.wage;
      p.cash += b.wage - tax - local;
      log(w, 'transfer', b.wage - tax - local, b.id, p.id, 'wage');
      log(w, 'sink', tax, b.id, 'treasury', 'wage tax');
      if (town) payTown(w, town, b.id, local, 'wage tax');
    }
  }
}
/** Exact need/health boundaries keep disconnect catch-up equivalent to live ticks.
 * Split only at room expiry and death, not at every simulated second. */
function advanceSurvival(w: World, p: Player, start: number, seconds: number) {
  const { needsAutoFeedThreshold: feedThreshold, needsDamageThreshold: damageThreshold } =
    survivalRules(w.settings);
  let elapsed = 0;
  while (elapsed < seconds) {
    const grace = Math.max(0, (p.needsGraceUntil ?? 0) - start - elapsed);
    if (grace > 0) {
      elapsed += Math.min(grace, seconds - elapsed);
      continue;
    }
    const current = shelter(w, p, start + elapsed);
    if (!current) p.atHome = false;
    // Snap numerical boundaries so a near-zero duration cannot stall catch-up.
    for (const need of ['hunger', 'thirst'] as const) {
      for (const boundary of [feedThreshold, damageThreshold])
        if (Math.abs(p[need] - boundary) < 1e-7) p[need] = boundary;
    }
    const pantries = automaticPantries(w, p, start + elapsed);
    for (const pantry of pantries) {
      const before = pantry.boat ? { ...pantry.stock } : undefined;
      feedShelterNow(w, p, pantry.stock, start + elapsed);
      if (before) voyageMeals(w, p, before, pantry.stock);
    }
    const hungerRate = w.settings.hungerRate * (current ? homeNeedsMultiplier(w) : 1),
      thirstRate = w.settings.thirstRate * (current ? homeNeedsMultiplier(w) : 1);
    const starving = p.hunger >= damageThreshold || p.thirst >= damageThreshold;
    const boundary = (value: number, rate: number) =>
      value < damageThreshold && rate > 0 ? (damageThreshold - value) / rate : Infinity;
    const duration = Math.min(
      seconds - elapsed,
      current ? current.until - start - elapsed : Infinity,
      ...pantries.map((pantry) => pantry.until - start - elapsed),
      ...pantries.map((pantry) => nextShelterMeal(w, p, pantry.stock, hungerRate, thirstRate)),
      boundary(p.hunger, hungerRate),
      boundary(p.thirst, thirstRate),
      starving ? p.health / 6 : Infinity,
    );
    p.hunger = Math.min(damageThreshold, p.hunger + hungerRate * duration);
    p.thirst = Math.min(damageThreshold, p.thirst + thirstRate * duration);
    p.health = Math.max(
      0,
      Math.min(maximumHealth(p, w), p.health + (starving ? -6 : 2) * duration),
    );
    elapsed += duration;
    if (p.health <= 1e-7)
      kill(
        w,
        p,
        false,
        p.thirst >= damageThreshold ? 'dehydration' : 'starvation',
        start + elapsed,
      );
  }
  if (p.atHome && !shelter(w, p)) p.atHome = false;
}

export function advance(w: World, seconds: number) {
  refreshPumpRecipes(w);
  ensurePastures(w);
  if (!Number.isFinite(seconds) || seconds <= 0 || w.maintenance?.paused) return;
  expireMeat(w);
  const boundary = Math.min(
    ...Object.values(w.players).flatMap((p) =>
      p.task &&
      (p.task.arrival || p.task.mount || ['homeCook', 'slaughter'].includes(p.task.kind)) &&
      p.task.end > w.time
        ? [p.task.end]
        : [],
    ),
    ...w.buildings.flatMap((b) =>
      [b.operatingLease?.ends, b.auction?.ends].filter(
        (v): v is number => v !== undefined && v > w.time,
      ),
    ),
  );
  if (boundary < w.time + seconds) {
    const first = boundary - w.time;
    advance(w, first);
    advance(w, seconds - first);
    return;
  }
  // Fixed economic boundaries make catch-up independent of client frame rate.
  const start = w.time,
    end = start + seconds;
  for (const b of w.buildings) {
    const interval = productionInterval(w, b);
    for (let t = (Math.floor(start / interval) + 1) * interval; t <= end; t += interval)
      cycle(w, b, t);
  }
  advanceManufacturing(w, start, end);
  weatherEarthworks(w, seconds);
  advanceClimate(w, start, end);
  w.time = end;
  advanceBridgeInspections(w);
  advanceBridgeSurveys(w);
  maintainBridges(w);
  towExpiredParking(w);
  advanceCapsizing(w, start, end, (p, force, cause, at) => kill(w, p, false, cause, at, force));
  advanceCharters(w, seconds);
  maintainTows(w);
  tickRadio(w, seconds);
  exportShipments(w, end);
  harbourSupply(w, end);
  restockGovernmentStores(w);
  growRoads(w, start, end);
  tickTowns(w);
  refreshOrders(w);
  tickTownEvents(w);
  tickCourses(w, seconds);
  tickRoundCycle(w);
  tickPropertyContracts(w);
  tickLottery(w);
  if (seconds <= 10) tickCreator(w);
  if (w.settings.dayLength > 0)
    w.settings.time = (w.settings.time + (seconds * 86400) / w.settings.dayLength) % 86400;
  for (const p of Object.values(w.players)) {
    if (p.crowClass && (!w.settings.crowAbilities || !w.settings.fighting)) returnCrow(w, p);
    if (p.online) {
      p.age += seconds / calendarYearSeconds(w.settings);
      p.lastSeen = end;
      delete p.inactivityProcessed;
      delete p.deathAnnouncedSinceVisit;
    }
    const absenceAt = p.lastSeen + w.settings.maxOfflineDays * 86400;
    const absenceDue =
      !p.online &&
      w.settings.maxOfflineDays > 0 &&
      end >= absenceAt &&
      p.inactivityProcessed !== p.lastSeen;
    const boundary = absenceDue ? Math.max(start, absenceAt) : end;
    // Apply the absence penalty at its deadline, after earlier loan payments and
    // survival, then simulate the rest of the absence in the new life.
    advanceLoans(w, p, start, boundary);
    advanceSurvival(w, p, start, boundary - start);
    if (absenceDue) {
      p.inactivityProcessed = p.lastSeen;
      if (announceDeath(w, p))
        say(w, 'Parish notice', `${p.name} exceeded this world's offline absence limit.`);
      removeAbsentParking(w, p);
      kill(w, p, false, 'offline absence limit', boundary);
      advanceLoans(w, p, boundary, end);
      advanceSurvival(w, p, boundary, end - boundary);
    }
    if (p.online) {
      p.energy = Math.min(65000, p.energy + survivalRules(w.settings).energyRegeneration * seconds);
      if (!p.health || p.age >= w.settings.maxAge)
        kill(w, p, false, p.age >= w.settings.maxAge ? 'old age' : 'injury');
    }
    if (p.learning && p.learning.end <= end) {
      p.skills.push(p.learning.skill);
      questEvent(w, p, 'study', p.learning.skill);
      queueCreatorScript(w, 'SkillLearned', { id: p.id, skill: p.learning.skill });
      recordLife(w, p, { kind: 'qualification', text: `Qualified as ${p.learning.skill}` });
      say(w, 'School', `${p.name} qualified as ${p.learning.skill}.`);
      delete p.learning;
    }
    if (p.task?.repeat && !p.online) cancelGather(w, p);
    if (p.task && p.task.end <= end) {
      const t = p.task;
      if (t.mount) {
        delete p.task;
        continue;
      }
      if (t.arrival) {
        finishArrival(w, p, end);
        continue;
      }
      if (t.kind === 'homeCook') {
        delete p.task;
        try {
          if (!t.cooking) throw Error('The cooking recipe is missing');
          say(
            w,
            'Kitchen',
            homeCook(w, p, { type: 'cook', menu: t.cooking.menu }, t.cooking),
            'system',
            p.id,
          );
        } catch (error) {
          say(
            w,
            'Kitchen',
            `Cooking cancelled: ${error instanceof Error ? error.message : String(error)}`,
            'system',
            p.id,
          );
        }
        continue;
      }
      if (t.kind === 'slaughter') {
        delete p.task;
        try {
          if (!t.slaughter) throw Error('The slaughter quote is missing');
          say(
            w,
            'Butcher',
            butcherAction(w, p, t.slaughter.action, t.slaughter, t.end),
            'system',
            p.id,
          );
        } catch (error) {
          say(
            w,
            'Butcher',
            `Slaughter cancelled: ${error instanceof Error ? error.message : String(error)}`,
            'system',
            p.id,
          );
        }
        continue;
      }
      if (t.kind === 'freight') {
        delete p.task;
        try {
          if (
            !t.freight ||
            freightAccess(w, p, t.freight.action.slot).landing.id !== t.freight.landing
          )
            throw Error('Return to the original freight landing');
          const result = act(w, p.id, t.freight.action, true);
          say(w, 'Freight', result, 'system', p.id);
        } catch (error) {
          say(
            w,
            'Freight',
            `Transfer cancelled: ${error instanceof Error ? error.message : String(error)}`,
            'system',
            p.id,
          );
        }
        continue;
      }
      if (t.kind === 'gather') {
        if (finishGather(p, w)) {
          breakLabourStreak(p);
          questEvent(w, p, 'gather', t.resource ?? '', t.item, t.amount);
          if (p.online) creatorEvent(w, 'task', p, t.resource ?? '');
          if (t.repeat && p.online) {
            try {
              gather(w, p, t.resource!);
              p.task!.repeat = true;
            } catch {
              /* Stop on depletion, tools, position or capacity. */
            }
          }
        }
        continue;
      }
      delete p.task;
      if (t.kind === 'harvest') {
        for (const index of t.plots ?? [t.plot!]) finishHarvest(w, p, t.building!, index, t.end);
        breakLabourStreak(p);
      } else if (t.kind === 'labour') {
        const reward = t.reward ?? labourReward(w, p);
        if (
          t.relief ||
          (t.reward === undefined && reward >= survivalRules(w.settings).labourReliefPay)
        )
          p.reliefAt = w.time;
        grant(w, p, reward, 'labour task');
        noteLabourPaid(w, p, reward, !!t.relief);
        p.kudos++;
      } else {
        breakLabourStreak(p);
        stockAdd(
          p.inventory,
          t.kind === 'logging' ? 'logs' : t.kind === 'quarrying' ? 'stone' : 'tools',
          t.kind === 'craft' ? 1 : 3,
        );
      }
      if (t.kind === 'logging' || t.kind === 'quarrying')
        recordGathered(w, p, t.kind === 'logging' ? 'logs' : 'stone', 3);
      if (p.online) creatorEvent(w, 'task', p, t.building ?? t.resource ?? '');
    }
    if (p.hitch) {
      const driver = w.players[p.hitch];
      if (driver) {
        Object.assign(
          p,
          cargoCrewPosition(
            w,
            driver,
            Object.values(w.players)
              .filter((q) => q.hitch === driver.id)
              .findIndex((q) => q.id === p.id),
          ) ?? { x: driver.x, z: driver.z, y: driver.y + 2 },
        );
      } else delete p.hitch;
    }
    if (p.race && end >= p.race.start) {
      const target = checkpoints[p.race.next % checkpoints.length];
      if (distance(p, target) < 10) {
        p.race.next++;
        if (p.race.next > checkpoints.length) {
          const lap = end - p.race.start;
          w.raceBest[p.name] = Math.min(w.raceBest[p.name] ?? Infinity, lap);
          p.kudos += 5;
          delete p.race;
          delete p.game;
          say(w, 'Race marshal', `${p.name} finished in ${lap.toFixed(1)} seconds.`);
        }
      }
    }
    if (p.game === 'fishing' && p.fishUntil !== undefined && end > p.fishUntil) {
      const catchId = landedFish(w, p);
      if (w.settings.fishingMode === 2 && canCarry(p, catchId, 1, w)) {
        stockAdd(p.inventory, catchId, 1);
        recordGathered(w, p, catchId, 1);
        if (p.fishingVoyage)
          p.fishingVoyage.caught[catchId] = (p.fishingVoyage.caught[catchId] ?? 0) + 1;
      }
      scheduleBite(w, p, end);
    }
  }
  expireAbandonedCargo(w);
  expireMeat(w);
  // Resolve residents once; avoid scanning every resident for every cottage each tick.
  const occupied = new Set(
    Object.values(w.players)
      .filter((p) => p.atHome)
      .map((p) => shelter(w, p)?.b.id),
  );
  for (const b of w.buildings) {
    expireFarmCrops(w, b);
    for (const [index, plot] of (b.plots ?? []).entries())
      if (plot.harvest) {
        const task = w.players[plot.harvest.player]?.task;
        const reserved =
          task?.kind === 'harvest' &&
          task.building === b.id &&
          (task.plots ? task.plots.includes(index) : task.plot === index);
        if (!reserved) delete plot.harvest;
      }
    b.smoking =
      !b.construction &&
      (b.kind === 'home' || roomCount(b)
        ? occupied.has(b.id)
        : b.employees.some((id) => {
            const worker = w.players[id];
            return (
              worker?.online &&
              worker.job === b.id &&
              worker.activeUntil >= end &&
              distance(worker, b) < 18
            );
          }));
    if (!b.government) {
      const owner = b.owner && w.players[b.owner];
      if (!owner || !owner.online) continue;
      const skill = b.recipe && recipes[b.recipe].skill;
      const factor = !owner ? 100 : skill && !owner.skills.includes(skill) ? 10 : 1;
      b.condition = Math.max(
        b.lodging || garageOccupied(w, b.id) ? 1 : 0,
        b.condition - (seconds * 100 * factor) / (160 * calendarYearSeconds(w.settings)),
      );
    }
  }
  for (const b of w.buildings) if (b.condition <= 0) contractsOnRemoval(w, b);
  w.buildings = w.buildings.filter((b) => b.condition > 0);
  const ball = w.ball,
    dt = Math.min(seconds, 1);
  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  ball.vx *= Math.exp(-1.1 * dt);
  ball.vz *= Math.exp(-1.1 * dt);
  if ((ball.x < 62 || ball.x > 118) && Math.abs(ball.z - 45) < 9) {
    const team = ball.x > 118 ? 0 : 1;
    w.scores[team]++;
    for (const p of Object.values(w.players).filter(
      (p) => p.game === 'hornball' && p.team === team,
    ))
      p.kudos += 3;
    say(w, 'Hornball', `Goal! Rust ${w.scores[0]} : ${w.scores[1]} Moss`);
    Object.assign(ball, { x: 90, z: 45, vx: 0, vz: 0 });
  } else if (ball.x < 60 || ball.x > 120 || ball.z < 20 || ball.z > 70)
    Object.assign(ball, { x: 90, z: 45, vx: 0, vz: 0 });
  tickCombat(w, seconds, (p) => kill(w, p, true));
  if (w.kricket.due && end > w.kricket.due + 1) {
    const batter = w.kricket.batter && w.players[w.kricket.batter];
    if (batter) kill(w, batter, true);
    w.kricket.due = 0;
  }
  const tier0 = ['farm', 'mill', 'bakery', 'sawmill', 'quarry', 'mason'];
  const tier1 = ['mine', 'forge', 'brewery', 'workshop', 'refinery'];
  if (tier0.every((kind) => w.buildings.some((b) => b.kind === kind && !b.construction)))
    w.tier = Math.max(w.tier, 1);
  if (tier1.every((kind) => w.buildings.some((b) => b.kind === kind && !b.construction)))
    w.tier = Math.max(w.tier, 2);
}

export function requireHerdRoom(w: World, b: Building, item: string, n: number) {
  const spec = herdSpec(b, w.settings);
  if (!spec || (item !== spec.animal && item !== spec.youngItem)) return;
  ensurePasture(w, b);
  const share = livestockRules(w.settings).livestockYoungPastureShare;
  requireThat(
    herdShares(b, w.settings) +
      n * (item === spec.youngItem ? share : 1) +
      Number(!!b.breedingEnd) * share <=
      pastureCapacity(b, w.settings.pastureCapacityMultiplier ?? 1),
    'Not enough grazing area; expand the pasture before adding livestock',
  );
}
